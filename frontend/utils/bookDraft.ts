const serverBaseUrl = process.env.NEXT_PUBLIC_BACKEND_SERVER_URL;

function authHeaders(token: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export type BookDraft = {
  _id: string;
  items: any[];
};

export async function createDraftBook(token: string, title?: string): Promise<BookDraft> {
  const res = await fetch(`${serverBaseUrl}/user/book`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      title: title && title.trim().length > 0 ? title.trim() : "My Keepsake Book",
      format: { size: "A4" },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Failed to create book");
  return data?.response?.data; // book object
}

export async function getBook(bookId: string, token: string): Promise<BookDraft> {
  const res = await fetch(`${serverBaseUrl}/user/book/${bookId}`, {
    method: "GET",
    headers: authHeaders(token),
  });

  const data = await res.json();
  console.log("getBook response data:", data);
  if (!res.ok) throw new Error(data?.message || "Failed to get book");
  return data?.response?.data; // book object
}

export type BookSummary = {
  _id: string;
  title: string;
  itemsCount?: number;
};

export async function getMyBooks(token: string): Promise<BookSummary[]> {
  const res = await fetch(`${serverBaseUrl}/user/book`, {
    method: "GET",
    headers: authHeaders(token),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Failed to get books");
  return (data?.response?.data || []) as BookSummary[];
}

export async function addStoryToBook(bookId: string, storyId: string, token: string) {
  const res = await fetch(`${serverBaseUrl}/user/book/${bookId}/items`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ storyId }),
  });
  const data = await res.json();
  if (!res.ok) {
    // duplicate story etc
    const msg = data?.message || "Failed to add story to book";
    const err: any = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return true;
}

export async function reorderBook(bookId: string, storyIds: string[], token: string) {
  const res = await fetch(`${serverBaseUrl}/user/book/${bookId}/reorder`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({ storyIds }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Failed to reorder book");
  return true;
}

export async function removeStoryFromBook(bookId: string, storyId: string, token: string) {
  const res = await fetch(`${serverBaseUrl}/user/book/${bookId}/items/${storyId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Failed to remove story from book");
  return true;
}

export async function generateBookPdf(
  bookId: string,
  token: string,
  podPackageId?: string,
  coverWidth?: string,
  coverHeight?: string,
  coverUnit?: string,
  coverImage?: string | null, // data URL, external URL, or null to clear
  authorName?: string | null,
  audioFile?: string | null, // base64 data URL, saved URL, or null to clear
  audioFileName?: string | null,
) {
  const body: any = {};
  if (podPackageId) body.pod_package_id = podPackageId;
  if (coverWidth) body.cover_width = coverWidth;
  if (coverHeight) body.cover_height = coverHeight;
  if (coverUnit) body.cover_unit = coverUnit;
  if (coverImage !== undefined) body.cover_image = coverImage;
  if (authorName !== undefined) body.author_name = authorName;
  if (audioFile !== undefined) body.audio_file = audioFile;
  if (audioFileName !== undefined) body.audio_file_name = audioFileName;

  const res = await fetch(`${serverBaseUrl}/user/book/${bookId}/generate-pdf`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Failed to generate PDF");
  return data?.response?.data?.pdfUrl as string;
}

export async function validateInterior(bookId: string, token: string, source_url?: string, pod_package_id?: string) {
  console.log("Validating interior with source_url:", source_url, "and pod_package_id:", pod_package_id);
  const res = await fetch(`${serverBaseUrl}/user/book/${bookId}/validate-interior`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ source_url, pod_package_id }),
  });
  const data = await res.json();
  console.log("Interior validation response data:", data);
  if (!res.ok) {
    const msg = data?.message || data || "Failed to validate interior";
    throw new Error(msg);
  }
  return data?.response?.data;
}

export async function getValidationStatus(bookId: string, token: string, validationId: string) {
  const res = await fetch(`${serverBaseUrl}/user/book/${bookId}/validate-interior/${validationId}`, {
    method: "GET",
    headers: authHeaders(token),
  });
  const data = await res.json();
  console.log("Interior validation status response data:", data);
  if (!res.ok) {
    const msg = data?.message || data || "Failed to fetch validation status";
    throw new Error(msg);
  }
  return data?.response?.data;
}

export async function validateCover(bookId: string, token: string, payload: { source_url?: string; pod_package_id: string; interior_page_count: number }) {
  const res = await fetch(`${serverBaseUrl}/user/book/${bookId}/validate-cover`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.message || data || "Failed to validate cover";
    throw new Error(msg);
  }
  return data?.response?.data;
}

export async function getCoverValidationStatus(bookId: string, token: string, validationId: string) {
  const res = await fetch(`${serverBaseUrl}/user/book/${bookId}/validate-cover/${validationId}`, {
    method: "GET",
    headers: authHeaders(token),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.message || data || "Failed to fetch cover validation status";
    throw new Error(msg);
  }
  return data?.response?.data;
}

export async function sendToLulu(
  bookId: string,
  token: string,
  payload: {
    contact_email: string;
    external_id?: string;
    quantity?: number;
    shipping_level: string;
    pod_package_id: string;
    coverUrl?: string;
    production_delay?: number;
    shipping_address: {
      city: string;
      country_code: string;
      name: string;
      phone_number: string;
      postcode: string;
      state_code: string;
      street1: string;
    };
  }
) {
  const res = await fetch(`${serverBaseUrl}/user/book/${bookId}/send-to-lulu`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Failed to create print job");
  return data?.response?.data;
}

export async function updateBookTitle(bookId: string, title: string, token: string) {
  const res = await fetch(`${serverBaseUrl}/user/book/${bookId}`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({ title }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Failed to update book title");
  return data?.response?.data as BookDraft;
}


export async function calculatePrintCost(
  bookId: string,
  token: string,
  payload: {
    shipping_address: {
      city: string;
      country_code: string;
      phone_number: string;
      postcode: string;
      state_code: string;
      street1: string;
    };
    shipping_option: string;
    line_items?: Array<{ page_count: number; pod_package_id: string; quantity: number }>;
    page_count?: number;
    pod_package_id?: string;
    quantity?: number;
  }
) {
  const res = await fetch(`${serverBaseUrl}/user/book/${bookId}/cost-estimate`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Failed to calculate print cost");
  return data?.response?.data;
}