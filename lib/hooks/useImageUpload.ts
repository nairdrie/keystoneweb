import { useState, useCallback } from 'react';

export function useImageUpload(siteId: string) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadImage = useCallback(
    async (file: File, contentKey: string): Promise<string> => {
      try {
        setUploading(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('siteId', siteId);
        formData.append('contentKey', contentKey);

        const res = await fetch('/api/sites/upload-image', {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Upload failed');
        }

        const { imageUrl } = await res.json();
        return imageUrl;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Upload failed';
        setError(errorMsg);
        throw err;
      } finally {
        setUploading(false);
      }
    },
    [siteId]
  );

  return {
    uploadImage,
    uploading,
    error,
    clearError: () => setError(null),
  };
}
