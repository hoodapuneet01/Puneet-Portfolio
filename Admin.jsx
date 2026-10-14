import { useEffect, useState, useCallback } from 'react'
import { LogOut, Plus, Pencil, Trash2, X, Smartphone } from 'lucide-react'
import { supabase, fileUrl, fmtDate, CATEGORIES } from './supabase.js'

const IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMG = 5 * 1024 * 1024
const MAX_APK = 100 * 1024 * 1024
const BLANK = {
  name: '', short_description: '', full_description: '', category: CATEGORIES[0], tech: [], live_url: '',
  apk_version: '', release_date: '', featured: false, status: 'draft',
  thumbnail_path: '', screenshots: [], apk_path: '', apk_size_bytes: null,
}
const nul = (v) => (typeof v === 'string' && v.trim() === '' ? null : v)
const remove = (bucket, paths) => (paths.length ? supabase.storage.from(bucket).remove(paths) : null)

/* ---------------- Login ---------------- */
function Login({ denied }) {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  async function go(e) {
    e.preventDefault(); setBusy(true); setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw })
    if (error) setErr('Login failed. Check your email and password.')
    setBusy(false)
  }
  return (
    <div className="center">
      <form className="glass form login" onSubmit={go}>
        <h2>Admin Login</h2>
        {denied && <p className="err">This account is not authorized as an administrator.</p>}
        <label>Email<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required /></label>
        <button className="btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        {err && <p className="err">{err}</p>}
        {denied && <button type="button" className="btn ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>}
        <a className="mut" href="/">← Back to website</a>
      </form>
    </div>
  )
}

/* ---------------- Project form ---------------- */
function ProjectForm({ project, onClose, onSaved }) {
  const isNew = !project
  const [f, setF] = useState(project ? { ...BLANK, ...project, live_url: project.live_url || '', apk_version: project.apk_version || '', release_date: project.release_date || '' } : BLANK)
  const [techStr, setTechStr] = useState((project?.tech || []).join(', '))
  const [thumb, setThumb] = useState(null)
  const [shots, setShots] = useState([])
  const [apk, setApk] = useState(null)
  const [removedShots, setRemovedShots] = useState([])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  function validate() {
    if (!f.name.trim()) return 'Project name is required.'
    if (!f.short_description.trim()) return 'Short description is required.'
    if (f.live_url.trim() && !/^https?:\/\//i.test(f.live_url.trim())) return 'Live URL must start with http:// or https://'
    for (const im of [thumb, ...shots].filter(Boolean)) {
      if (!IMG_TYPES.includes(im.type)) return `"${im.name}": images must be JPG, PNG or WebP.`
      if (im.size > MAX_IMG) return `"${im.name}" is larger than 5 MB.`
    }
    if (apk) {
      if (!apk.name.toLowerCase().endsWith('.apk')) return 'The Android file must end with .apk'
      if (apk.size > MAX_APK) return 'The APK is larger than 100 MB.'
    }
    return ''
  }

  async function save(e) {
    e.preventDefault()
    const v = validate()
    if (v) return setErr(v)
    setErr(''); setBusy('Uploading files…')
    const id = project?.id || crypto.randomUUID()
    const uploaded = [] // for cleanup if the database write fails
    const up = async (bucket, file, kind, type) => {
      const path = `${id}/${kind}-${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`
      const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: type || file.type, upsert: false })
      if (error) throw new Error(`Upload failed for ${file.name}: ${error.message}`)
      uploaded.push([bucket, path]); return path
    }
    try {
      const row = {
        id, name: f.name.trim(), short_description: f.short_description.trim(), full_description: f.full_description.trim(),
        category: f.category, tech: techStr.split(',').map((t) => t.trim()).filter(Boolean),
        live_url: nul(f.live_url?.trim()), apk_version: nul(f.apk_version?.trim()), release_date: nul(f.release_date),
        featured: f.featured, status: f.status,
        screenshots: f.screenshots.filter((s) => !removedShots.includes(s)),
      }
      if (thumb) row.thumbnail_path = await up('images', thumb, 'thumb')
      for (const s of shots) row.screenshots.push(await up('images', s, 'shot'))
      if (apk) { row.apk_path = await up('apks', apk, 'app', 'application/vnd.android.package-archive'); row.apk_size_bytes = apk.size }

      setBusy('Saving…')
      const q = isNew ? supabase.from('projects').insert(row) : supabase.from('projects').update(row).eq('id', id)
      const { error } = await q
      if (error) throw new Error(error.message)

      // Old files are deleted only after the new ones are safely saved.
      if (thumb && project?.thumbnail_path) await remove('images', [project.thumbnail_path])
      if (apk && project?.apk_path) await remove('apks', [project.apk_path])
      await remove('images', removedShots)
      onSaved(isNew ? 'Project created.' : 'Project updated.')
    } catch (e2) {
      await Promise.all(uploaded.map(([b, p]) => remove(b, [p]))) // nothing half-saved, old links untouched
      setErr(e2.message); setBusy('')
    }
  }

  return (
    <div className="overlay">
      <form className="modal glass form" onSubmit={save}>
        <button type="button" className="x" onClick={onClose} aria-label="Close"><X /></button>
        <h2>{isNew ? 'Add New Project' : 'Edit Project'}</h2>
        <label>Project name *<input value={f.name} onChange={set('name')} maxLength={120} /></label>
        <label>Short description *<input value={f.short_description} onChange={set('short_description')} maxLength={300} /></label>
        <label>Full description<textarea rows={5} value={f.full_description} onChange={set('full_description')} /></label>
        <div className="two">
          <label>Category<select value={f.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label>Status<select value={f.status} onChange={set('status')}><option value="draft">Draft (private)</option><option value="published">Published</option></select></label>
        </div>
        <label>Technology tags (comma separated)<input value={techStr} onChange={(e) => setTechStr(e.target.value)} placeholder="Flutter, Firebase" /></label>
        <label>Live website URL<input type="url" value={f.live_url} onChange={set('live_url')} placeholder="https://" /></label>

        <label>Thumbnail image {f.thumbnail_path && '(current one is kept unless you choose a new file)'}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setThumb(e.target.files[0] || null)} /></label>
        {f.thumbnail_path && !thumb && <img className="pv" src={fileUrl('images', f.thumbnail_path)} alt="" />}

        <label>Add screenshots<input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(e) => setShots([...e.target.files])} /></label>
        <div className="shots">
          {f.screenshots.filter((s) => !removedShots.includes(s)).map((s) => (
            <span key={s} className="pvw"><img className="pv" src={fileUrl('images', s)} alt="" />
              <button type="button" onClick={() => setRemovedShots([...removedShots, s])}>×</button></span>
          ))}
        </div>

        <fieldset><legend><Smartphone size={14} /> Android APK</legend>
          {f.apk_path && !apk && <p className="mut">An APK is uploaded. Choose a new file to replace it (the old one is removed only after the new upload succeeds).</p>}
          <label>APK file (.apk, max 100 MB)<input type="file" accept=".apk,application/vnd.android.package-archive" onChange={(e) => setApk(e.target.files[0] || null)} /></label>
          <div className="two">
            <label>APK version<input value={f.apk_version} onChange={set('apk_version')} placeholder="1.0.0" /></label>
            <label>Release date<input type="date" value={f.release_date} onChange={set('release_date')} /></label>
          </div>
        </fieldset>
        <label className="check"><input type="checkbox" checked={f.featured} onChange={set('featured')} /> Featured project</label>
        {err && <p className="err">{err}</p>}
        <div className="actions">
          <button className="btn" disabled={!!busy}>{busy || 'Save Project'}</button>
          <button type="button" className="btn ghost" onClick={onClose} disabled={!!busy}>Cancel</button>
        </div>
      </form>
    </div>
  )
}

/* ---------------- Dashboard ---------------- */
function Dashboard() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('All')
  const [edit, setEdit] = useState(undefined) // undefined=closed, null=new, object=editing
  const [del, setDel] = useState(null)
  const [toast, setToast] = useState(null)
  const [limit, setLimit] = useState(10)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('projects').select('*').order('updated_at', { ascending: false })
    if (error) setToast({ ok: false, m: error.message }); else setRows(data)
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const flash = (m, ok = true) => { setToast({ ok, m }); setTimeout(() => setToast(null), 4000) }
  const list = rows.filter((p) => (cat === 'All' || p.category === cat) && p.name.toLowerCase().includes(q.toLowerCase()))

  async function confirmDelete() {
    const p = del
    const { error } = await supabase.from('projects').delete().eq('id', p.id)
    if (error) { flash('Delete failed: ' + error.message, false); return setDel(null) }
    await remove('images', [p.thumbnail_path, ...p.screenshots].filter(Boolean))
    await remove('apks', [p.apk_path].filter(Boolean))
    setDel(null); flash(`"${p.name}" deleted.`); load()
  }

  const stats = [['Total Projects', rows.length], ['Published', rows.filter((p) => p.status === 'published').length],
    ['Drafts', rows.filter((p) => p.status === 'draft').length], ['With APKs', rows.filter((p) => p.apk_path).length]]

  return (
    <div className="wrap admin">
      <div className="bar"><h1>Dashboard</h1>
        <div className="actions"><a className="btn ghost sm" href="/">View site</a>
          <button className="btn ghost sm" onClick={() => supabase.auth.signOut()}><LogOut size={15} /> Logout</button></div></div>
      <div className="stats">{stats.map(([k, v]) => <div className="glass stat" key={k}><b>{v}</b><span className="mut">{k}</span></div>)}</div>
      <div className="bar"><h2>Manage Projects</h2><button className="btn" onClick={() => setEdit(null)}><Plus size={16} /> Add New Project</button></div>
      <div className="two">
        <input placeholder="Search projects…" value={q} onChange={(e) => { setQ(e.target.value); setLimit(10) }} />
        <select value={cat} onChange={(e) => { setCat(e.target.value); setLimit(10) }}><option>All</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
      </div>
      {loading && <p className="mut">Loading…</p>}
      {!loading && !list.length && <p className="mut">No projects found.</p>}
      {list.slice(0, limit).map((p) => (
        <div className="glass prow" key={p.id}>
          <div className="pthumb">{p.thumbnail_path ? <img src={fileUrl('images', p.thumbnail_path)} alt="" /> : <span>{p.name[0]}</span>}</div>
          <div className="pinfo"><b>{p.name}</b>
            <div className="mut">{p.category} · Updated {fmtDate(p.updated_at)}</div>
            <div className="chips"><span className={`chip ${p.status === 'published' ? 'on' : ''}`}>{p.status}</span>
              <span className="chip">{p.apk_path ? `APK ${p.apk_version ? 'v' + p.apk_version : '✓'}` : 'No APK'}</span></div></div>
          <div className="actions">
            <button className="btn ghost sm" onClick={() => setEdit(p)}><Pencil size={14} /> Edit</button>
            <button className="btn red sm" onClick={() => setDel(p)}><Trash2 size={14} /> Delete</button>
          </div>
        </div>
      ))}
      {list.length > limit && <button className="btn ghost" onClick={() => setLimit(limit + 10)}>Load more</button>}

      {edit !== undefined && <ProjectForm project={edit} onClose={() => setEdit(undefined)} onSaved={(m) => { setEdit(undefined); flash(m); load() }} />}
      {del && (
        <div className="overlay"><div className="modal glass small">
          <h3>Delete project?</h3>
          <p>You are about to permanently delete <b>{del.name}</b>, including its images and APK. This cannot be undone.</p>
          <div className="actions"><button className="btn red" onClick={confirmDelete}>Yes, delete</button>
            <button className="btn ghost" onClick={() => setDel(null)}>Cancel</button></div>
        </div></div>
      )}
      {toast && <div className={`toast ${toast.ok ? 'ok' : 'err'}`}>{toast.m}</div>}
    </div>
  )
}

/* ---------------- Gate ---------------- */
export default function Admin() {
  const [state, setState] = useState('loading')
  const check = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return setState('login')
    const { data } = await supabase.rpc('is_admin')
    setState(data === true ? 'ok' : 'denied')
  }, [])
  useEffect(() => {
    check()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => setTimeout(check, 0))
    return () => subscription.unsubscribe()
  }, [check])
  return (
    <>
      <div className="aurora"><i /><i /><i /></div>
      {state === 'loading' && <div className="center"><p className="mut">Loading…</p></div>}
      {state === 'login' && <Login />}
      {state === 'denied' && <Login denied />}
      {state === 'ok' && <Dashboard />}
    </>
  )
}
