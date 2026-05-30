import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Durable object storage for project files (site plans, documents).
// Backed by Supabase Storage — the local filesystem is read-only/ephemeral on
// serverless (Vercel), so uploads must never touch disk.

const BUCKET = "project-files";

let client: SupabaseClient | null = null;
let bucketReady: Promise<void> | null = null;

function getClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

// Idempotent, cached per instance — creates the private bucket on first upload.
async function ensureBucket(): Promise<void> {
  if (bucketReady) return bucketReady;
  bucketReady = (async () => {
    const supabase = getClient();
    const { data } = await supabase.storage.getBucket(BUCKET);
    if (!data) {
      await supabase.storage.createBucket(BUCKET, {
        public: false,
        fileSizeLimit: 52428800, // 50 MB
      });
    }
  })();
  return bucketReady;
}

export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  await ensureBucket();
  const { error } = await getClient().storage
    .from(BUCKET)
    .upload(key, body, { contentType, upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
}

export async function downloadFile(key: string): Promise<Buffer | null> {
  const { data, error } = await getClient().storage.from(BUCKET).download(key);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

export async function deleteFile(key: string): Promise<void> {
  await getClient().storage.from(BUCKET).remove([key]);
}
