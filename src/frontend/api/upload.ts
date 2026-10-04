import { apiRequest } from "./http";

export type UploadedFileMeta = {
  url: string;
  name: string;
  size: number;
  type: string;
};

export async function uploadFileOrBlob(
  fileOrBlob: File | Blob,
  fileName: string,
  accessToken: string,
): Promise<{ success: true; data: UploadedFileMeta } | { success: false; message: string }> {
  try {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          reject(new Error("Failed to read file"));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(fileOrBlob);
    });

    const response = await apiRequest<UploadedFileMeta>(
      "/api/upload",
      {
        method: "POST",
        body: JSON.stringify({
          name: fileName,
          type: fileOrBlob.type || "application/octet-stream",
          data: base64,
        }),
      },
      accessToken,
    );

    return response;
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Failed to upload file.",
    };
  }
}
