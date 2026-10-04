<?php

namespace App\Http\Controllers\Api\Resident;

use App\Http\Controllers\Controller;
use App\Models\Household;
use App\Models\HouseholdDocument;
use App\Services\HouseholdService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * Resident app: submit the household (with supporting documents) and follow its status.
 * The submission goes to the barangay's QR Issuance Review, scored and duplicate-checked
 * by the same HouseholdService as walk-in registrations.
 */
class HouseholdController extends Controller
{
    public function __construct(private HouseholdService $service) {}

    public function show(Request $request)
    {
        $household = $this->own($request);
        abort_unless($household, 404, 'No household registered yet.');

        return response()->json($this->present($household));
    }

    /** First submission, or resubmission after a rejection. Sent as multipart form data. */
    public function store(Request $request)
    {
        // Multipart forms can't nest arrays easily, so the app sends members as a JSON string
        if (is_string($request->input('members'))) {
            $request->merge(['members' => json_decode($request->input('members'), true)]);
        }

        $data = $request->validate([
            'barangay_id' => ['required', 'exists:barangays,id'],
            'purok' => ['required', 'string', 'max:50'],
            'address' => ['nullable', 'string', 'max:255'],
            'is_solo_parent' => ['nullable', 'boolean'],
            'members' => ['required', 'array', 'min:1', 'max:30'],
            'members.0.relationship' => ['in:Head'],
            'members.*.full_name' => ['required', 'string', 'max:150'],
            'members.*.relationship' => ['required', 'in:Head,Spouse,Child,Parent,Sibling,Grandchild,Relative,Other'],
            'members.*.birthdate' => ['required', 'date', 'before_or_equal:today'],
            'members.*.sex' => ['required', 'in:M,F'],
            'members.*.is_pwd' => ['boolean'],
            'members.*.is_pregnant' => ['boolean'],
            // Photos come either as file uploads or as base64 text in a JSON request (the mobile app)
            'valid_id' => ['required_without:valid_id_base64', 'nullable', 'file', 'mimes:jpg,jpeg,png,webp,heic', 'max:10240'],
            'birth_certificate' => ['required_without:birth_certificate_base64', 'nullable', 'file', 'mimes:jpg,jpeg,png,webp,heic', 'max:10240'],
            'valid_id_base64' => ['required_without:valid_id', 'nullable', 'string'],
            'birth_certificate_base64' => ['required_without:birth_certificate', 'nullable', 'string'],
        ], [
            'members.0.relationship.in' => 'The first member listed must be the household head.',
            'members.*.birthdate.required' => 'Every member needs a birthdate.',
            'members.*.sex.required' => 'Select the sex of every member.',
            'valid_id.required_without' => 'Upload a photo of a valid ID.',
            'birth_certificate.required_without' => 'Upload a photo of the birth certificate.',
            'valid_id_base64.required_without' => 'Upload a photo of a valid ID.',
            'birth_certificate_base64.required_without' => 'Upload a photo of the birth certificate.',
            'valid_id.max' => 'The valid ID photo must be under 10 MB.',
            'birth_certificate.max' => 'The birth certificate photo must be under 10 MB.',
        ]);

        $photos = [];
        foreach (['valid_id', 'birth_certificate'] as $type) {
            $photos[$type] = $request->hasFile($type)
                ? $this->fromUpload($request->file($type))
                : $this->fromBase64($request->input("{$type}_base64"), $type);
        }

        $user = $request->user();
        $household = $this->own($request);

        if ($household && $household->status !== 'rejected') {
            throw ValidationException::withMessages([
                'household' => $household->status === 'pending'
                    ? 'Your household is already submitted and waiting for review.'
                    : 'Your household is already approved.',
            ]);
        }

        $household ??= new Household(['user_id' => $user->id, 'registration_type' => 'online']);
        $household->forceFill([
            'barangay_id' => $data['barangay_id'],
            'status' => 'pending',
            'rejection_reason' => null,
        ]);

        $this->service->save($household, $data + ['contact_number' => $user->phone]);

        foreach ($photos as $type => $photo) {
            $old = $household->documents()->where('type', $type)->first();
            if ($old) {
                Storage::disk('local')->delete($old->path);
            }

            $path = "household-documents/{$household->id}/{$type}-".now()->format('YmdHis').".{$photo['ext']}";
            Storage::disk('local')->put($path, $photo['bytes']);

            HouseholdDocument::updateOrCreate(
                ['household_id' => $household->id, 'type' => $type],
                [
                    'path' => $path,
                    'original_name' => $photo['name'],
                    'mime_type' => $photo['mime'],
                    'size' => strlen($photo['bytes']),
                ],
            );
        }

        return response()->json($this->present($household->fresh()), 201);
    }

    private const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
    private const PHOTO_TYPES = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/heic' => 'heic'];

    /** @return array{bytes: string, mime: string, ext: string, name: string} */
    private function fromUpload(\Illuminate\Http\UploadedFile $file): array
    {
        $mime = $file->getMimeType() ?? 'image/jpeg';

        return [
            'bytes' => $file->get(),
            'mime' => $mime,
            'ext' => self::PHOTO_TYPES[$mime] ?? $file->extension() ?? 'jpg',
            'name' => $file->getClientOriginalName(),
        ];
    }

    /** Accepts plain base64 or a data URI ("data:image/jpeg;base64,..."). Checks the real file type. */
    private function fromBase64(?string $value, string $type): array
    {
        $label = $type === 'valid_id' ? 'valid ID' : 'birth certificate';
        $data = preg_replace('/^data:[^;]+;base64,/', '', trim((string) $value));
        $bytes = base64_decode($data, true);

        if ($bytes === false || $bytes === '') {
            throw ValidationException::withMessages(["{$type}_base64" => "The {$label} photo could not be read. Please choose it again."]);
        }
        if (strlen($bytes) > self::MAX_PHOTO_BYTES) {
            throw ValidationException::withMessages(["{$type}_base64" => "The {$label} photo must be under 10 MB."]);
        }

        $mime = (new \finfo(FILEINFO_MIME_TYPE))->buffer($bytes) ?: '';
        if (! isset(self::PHOTO_TYPES[$mime])) {
            throw ValidationException::withMessages(["{$type}_base64" => "The {$label} must be a photo (JPG, PNG, WEBP or HEIC)."]);
        }

        return ['bytes' => $bytes, 'mime' => $mime, 'ext' => self::PHOTO_TYPES[$mime], 'name' => "{$type}.".self::PHOTO_TYPES[$mime]];
    }

    private function own(Request $request): ?Household
    {
        return Household::where('user_id', $request->user()->id)->latest('id')->first();
    }

    /** What the resident app needs, without internal fields (QR secret, priority score, reviewer). */
    private function present(Household $h): array
    {
        $h->loadMissing(['barangay:id,name', 'members', 'documents']);

        return [
            'id' => $h->id,
            'status' => $h->status,
            'rejection_reason' => $h->rejection_reason,
            'reference_number' => $h->reference_number,
            // Dynamic QR: reference number + the token issued at this resident's latest login
            'qr_value' => $h->qrValue(),
            'household_head' => $h->household_head,
            'contact_number' => $h->contact_number,
            'barangay' => $h->barangay,
            'purok' => $h->purok,
            'address' => $h->address,
            'is_solo_parent' => $h->is_solo_parent,
            'members' => $h->members->map(fn ($m) => [
                'full_name' => $m->full_name,
                'relationship' => $m->relationship,
                'birthdate' => $m->birthdate?->toDateString(),
                'sex' => $m->sex,
                'is_pwd' => $m->is_pwd,
                'is_pregnant' => $m->is_pregnant,
                'age' => $m->age,
            ])->values(),
            'documents' => $h->documents->map->only(['type', 'label', 'created_at'])->values(),
            'submitted_at' => $h->created_at,
            'approved_at' => $h->approved_at,
        ];
    }
}
