const GOOGLE_DRIVE_API_URL = "https://www.googleapis.com/drive/v3/files";
const GOOGLE_DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";
const FILE_NAME = "rule43_calculator_data.json";

export interface GoogleDriveFile {
  id: string;
  name: string;
}

/**
 * Searches for the tax data JSON file in the user's Google Drive.
 * We restrict the search to our specific file name and ensure it's not in the trash.
 */
export async function searchTaxDataFile(accessToken: string): Promise<string | null> {
  const query = `name = '${FILE_NAME}' and trashed = false`;
  const url = `${GOOGLE_DRIVE_API_URL}?q=${encodeURIComponent(query)}&fields=files(id,name)`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Google Drive Search Error:", errText);
      throw new Error(`Failed to search Google Drive: ${response.statusText}`);
    }

    const result = await response.json();
    const files = result.files || [];
    if (files.length > 0) {
      return files[0].id;
    }
    return null;
  } catch (error) {
    console.error("searchTaxDataFile failed:", error);
    throw error;
  }
}

/**
 * Downloads the JSON content of a specific Google Drive file by ID.
 */
export async function downloadTaxDataFile(accessToken: string, fileId: string): Promise<any> {
  const url = `${GOOGLE_DRIVE_API_URL}/${fileId}?alt=media`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Google Drive Download Error:", errText);
      throw new Error(`Failed to download file from Google Drive: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("downloadTaxDataFile failed:", error);
    throw error;
  }
}

/**
 * Creates or updates the tax data JSON file on Google Drive.
 * Uses multipart upload to set both metadata (name) and JSON content.
 */
export async function uploadTaxDataFile(
  accessToken: string,
  fileId: string | null,
  data: any
): Promise<string> {
  try {
    const boundary = "3d9f108860cbd";
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--\r\n`;

    const metadata = {
      name: FILE_NAME,
      mimeType: "application/json",
    };

    const mediaBody = JSON.stringify(data, null, 2);

    let url = GOOGLE_DRIVE_UPLOAD_URL;
    let method = "POST";

    if (fileId) {
      // If file exists, we perform an UPDATE (PATCH)
      url = `${GOOGLE_DRIVE_UPLOAD_URL}/${fileId}?uploadType=multipart`;
      method = "PATCH";
    } else {
      // If file does not exist, we perform a CREATE (POST)
      url = `${GOOGLE_DRIVE_UPLOAD_URL}?uploadType=multipart`;
      method = "POST";
    }

    const multipartRequestBody =
      `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `${delimiter}Content-Type: application/json\r\n\r\n` +
      `${mediaBody}` +
      `${closeDelimiter}`;

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
        "Content-Length": String(multipartRequestBody.length),
      },
      body: multipartRequestBody,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Google Drive Upload Error:", errText);
      throw new Error(`Failed to upload to Google Drive: ${response.statusText}`);
    }

    const result = await response.json();
    return result.id;
  } catch (error) {
    console.error("uploadTaxDataFile failed:", error);
    throw error;
  }
}
