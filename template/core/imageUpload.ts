import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

export interface ImagePickerResult {
  uri: string;
  base64?: string;
  width: number;
  height: number;
}

/**
 * Request camera roll permissions
 */
export const requestImagePermissions = async (): Promise<boolean> => {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
};

/**
 * Pick an image from the gallery with cropping
 */
export const pickImage = async (): Promise<ImagePickerResult | null> => {
  try {
    // Request permissions
    const hasPermission = await requestImagePermissions();
    if (!hasPermission) {
      throw new Error('Camera roll permissions are required to upload images');
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true, // Enable built-in cropping
      aspect: [1, 1], // Square aspect ratio for profile pictures
      quality: 0.8, // Good quality while reducing file size
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];

    // Further compress the image if needed
    const manipulatedImage = await ImageManipulator.manipulateAsync(
      asset.uri,
      [
        // Resize to max 800x800 to keep file size reasonable
        { resize: { width: 800 } },
      ],
      {
        compress: 0.8,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    return {
      uri: manipulatedImage.uri,
      width: manipulatedImage.width,
      height: manipulatedImage.height,
    };
  } catch (error: any) {
    throw new Error(error.message || 'Failed to pick image');
  }
};

