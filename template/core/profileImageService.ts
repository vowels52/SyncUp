import { getSupabaseClient } from '@/template';
import { readAsStringAsync } from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { Platform } from 'react-native';

const PROFILE_IMAGES_BUCKET = 'profile-images';

export interface UploadProfileImageParams {
  userId: string;
  imageUri: string;
}

export interface UploadProfileImageResult {
  imageUrl: string;
}

/**
 * Convert URI to base64 - Platform specific implementation
 */
const uriToBase64 = async (uri: string): Promise<string> => {
  if (Platform.OS === 'web') {
    // On web, the URI is already a data URL with base64
    // Format: data:image/jpeg;base64,/9j/4AAQSkZJRg...
    if (uri.startsWith('data:')) {
      const base64 = uri.split(',')[1];
      return base64;
    }

    // If it's a blob URL, fetch it
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } else {
    // On native, use expo-file-system
    return await readAsStringAsync(uri, {
      encoding: 'base64',
    });
  }
};

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

    // Read the file as base64 (platform-specific)
    const base64 = await uriToBase64(imageUri);

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
