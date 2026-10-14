import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export const CATEGORIES = ['Web Development', 'Android Applications', 'AI and Machine Learning', 'Software Development', 'Other']

// Public URL of a stored file. With `download`, the browser is forced to save the real file.
export const fileUrl = (bucket, path, download) =>
  path ? supabase.storage.from(bucket).getPublicUrl(path, download ? { download } : undefined).data.publicUrl : ''

export const fmtSize = (b) => (!b ? '' : b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB')
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '')
