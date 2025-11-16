# Supabase Storage Setup for Profile Images

This guide will help you set up the Supabase Storage bucket needed for profile image uploads.

## Step 1: Access Supabase Dashboard

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Sign in to your account
3. Select your SyncUp project

## Step 2: Create Storage Bucket

1. In the left sidebar, click on **Storage**
2. Click the **New bucket** button (or **Create a new bucket**)
3. Configure the bucket with these settings:
   - **Name**: `profile-images`
   - **Public bucket**: ✅ **Check this box** (profile images need to be publicly accessible)
   - **File size limit**: 5MB (optional, but recommended)
   - **Allowed MIME types**: Leave empty or add: `image/jpeg, image/jpg, image/png` (optional)
4. Click **Create bucket**

## Step 3: Set Up Storage Policies

You need to create policies to allow users to upload, update, and view profile images.

1. Click on your newly created `profile-images` bucket
2. Go to the **Policies** tab (or **Configuration** → **Policies**)
3. Create the following policies:

### Policy 1: Public Read Access
This allows anyone to view profile images.

- **Policy name**: `Public read access for profile images`
- **Allowed operation**: `SELECT`
- **Target roles**: `public`
- **USING expression**:
  ```sql
  true
  ```
- **WITH CHECK expression**: Leave empty

Click **Review** and then **Save policy**

### Policy 2: Authenticated Upload
This allows authenticated users to upload their own profile images.

- **Policy name**: `Authenticated users can upload profile images`
- **Allowed operation**: `INSERT`
- **Target roles**: `authenticated`
- **USING expression**: Leave empty
- **WITH CHECK expression**:
  ```sql
  (bucket_id = 'profile-images'::text)
  AND (auth.uid()::text = (storage.foldername(name))[1])
  ```

Click **Review** and then **Save policy**

### Policy 3: Authenticated Update/Delete
This allows users to update or delete their own profile images.

- **Policy name**: `Users can update their own profile images`
- **Allowed operation**: `UPDATE` and `DELETE`
- **Target roles**: `authenticated`
- **USING expression**:
  ```sql
  (bucket_id = 'profile-images'::text)
  AND (auth.uid()::text = (storage.foldername(name))[1])
  ```
- **WITH CHECK expression**: Leave empty

Click **Review** and then **Save policy**

## Step 4: Verify Setup

To verify your setup is working:

1. Go to the **Storage** section
2. You should see the `profile-images` bucket listed
3. The bucket should show as **Public**
4. Under **Policies**, you should see all three policies listed

## Alternative: Using SQL Editor

If you prefer, you can create all policies at once using the SQL Editor:

1. Go to **SQL Editor** in the left sidebar
2. Click **New query**
3. Paste and run this SQL:

```sql
-- Enable public read access
CREATE POLICY "Public read access for profile images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profile-images');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload profile images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update/delete their own images
CREATE POLICY "Users can update their own profile images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own profile images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

4. Click **Run** or press `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)

## Testing

Once setup is complete, you can test the functionality:

1. Run your SyncUp app
2. Navigate to the Profile screen
3. Tap the camera icon on your profile picture
4. Select an image from your gallery
5. Crop the image (the app will show a cropping interface)
6. The image should upload and display on your profile

## Troubleshooting

### Error: "Failed to upload profile image"

**Possible causes:**
- Storage bucket not created or named incorrectly (must be exactly `profile-images`)
- Bucket is not set to public
- Storage policies are missing or incorrect

**Solution:**
- Double-check bucket name matches exactly: `profile-images`
- Verify bucket is set to **Public**
- Review and recreate the policies above

### Error: "Camera roll permissions are required"

**Cause:** The app needs permission to access your photo library

**Solution:**
- On iOS: Go to Settings → SyncUp → Photos → Select "All Photos"
- On Android: Grant storage/media permissions when prompted

### Images not displaying

**Possible causes:**
- Public read policy is missing
- Bucket is not set to public

**Solution:**
- Ensure the "Public read access" policy is created
- Verify the bucket is marked as **Public** in Supabase

## Additional Notes

- Profile images are automatically resized to 800x800 pixels to save storage space
- Images are converted to JPEG format with 80% quality
- Old profile images are automatically deleted when a new image is uploaded
- Images are stored in folders named by user ID: `{userId}/{timestamp}.jpg`

## Need Help?

If you encounter any issues:
1. Check the Supabase logs in the Dashboard
2. Check the app console for detailed error messages
3. Verify all bucket names and policy expressions match exactly
4. Ensure your Supabase project is active and not paused
