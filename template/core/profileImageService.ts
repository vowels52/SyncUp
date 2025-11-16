import { getSupabaseClient } from '@/template';
import { readAsStringAsync } from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

const PROFILE_IMAGES_BUCKET = 'profile-images';

export interface UploadProfileImageParams {
  userId: string;
  imageUri: string;
}

export interface UploadProfileImageResult {
  imageUrl: string;
}

/**
 * Upload a profile image to Supabase Storage and update user profile
 */
export const uploadProfileImage = async ({
  userId,
  imageUri,
}: UploadProfileImageParams): Promise<UploadProfileImageResult> => {
  const supabase = getSupabaseClient();

  try {
    // Generate a unique file name using user ID and timestamp
    const fileExt = 'jpg'; // We always convert to JPEG in the image picker
    const fileName = `${userId}_${Date.now()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    // Read the file as base64 using expo-file-system
    const base64 = await readAsStringAsync(imageUri, {
      encoding: 'base64',
    });

    // Convert base64 to ArrayBuffer for Supabase
    const arrayBuffer = decode(base64);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(PROFILE_IMAGES_BUCKET)
      .upload(filePath, arrayBuffer, {
        contentType: 'image/jpeg',
        upsert: false, // Create new file each time
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL for the uploaded image
    const { data: urlData } = supabase.storage
      .from(PROFILE_IMAGES_BUCKET)
      .getPublicUrl(filePath);

    const imageUrl = urlData.publicUrl;

    // Update user profile with the new image URL
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ profile_image_url: imageUrl })
      .eq('id', userId);

    if (updateError) {
      // If profile update fails, try to delete the uploaded image
      await supabase.storage.from(PROFILE_IMAGES_BUCKET).remove([filePath]);
      throw updateError;
    }

    return { imageUrl };
  } catch (error: any) {
    console.error('Profile image upload error:', error);
    throw new Error(error.message || 'Failed to upload profile image');
  }
};

/**
 * Delete old profile image from storage
 */
export const deleteOldProfileImage = async (imageUrl: string): Promise<void> => {
  try {
    const supabase = getSupabaseClient();

    // Extract file path from URL
    // URL format: https://[project].supabase.co/storage/v1/object/public/profile-images/[path]
    const urlParts = imageUrl.split(`${PROFILE_IMAGES_BUCKET}/`);
    if (urlParts.length < 2) {
      console.warn('Invalid image URL format, skipping deletion');
      return;
    }

    const filePath = urlParts[1];

    // Delete from storage
    const { error } = await supabase.storage
      .from(PROFILE_IMAGES_BUCKET)
      .remove([filePath]);

    if (error) {
      console.error('Failed to delete old profile image:', error);
      // Don't throw error - this is a cleanup operation
    }
  } catch (error) {
    console.error('Error deleting old profile image:', error);
    // Don't throw error - this is a cleanup operation
  }
};

/**
 * Upload profile image and clean up old one
 */
export const updateProfileImage = async (
  userId: string,
  imageUri: string,
  oldImageUrl?: string | null
): Promise<UploadProfileImageResult> => {
  // Upload new image first
  const result = await uploadProfileImage({ userId, imageUri });

  // Try to delete old image if it exists
  if (oldImageUrl) {
    await deleteOldProfileImage(oldImageUrl);
  }

  return result;
};

/**
 * Remove profile image completely
 */
export const removeProfileImage = async (
  userId: string,
  imageUrl: string
): Promise<void> => {
  const supabase = getSupabaseClient();

  try {
    // Delete from storage first
    await deleteOldProfileImage(imageUrl);

    // Update user profile to remove the image URL
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ profile_image_url: null })
      .eq('id', userId);

    if (updateError) {
      throw updateError;
    }
  } catch (error: any) {
    console.error('Failed to remove profile image:', error);
    throw new Error(error.message || 'Failed to remove profile image');
  }
};
