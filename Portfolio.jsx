import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Download, ExternalLink, Mail, X, Send, Smartphone } from 'lucide-react'
import { supabase, fileUrl, fmtSize, fmtDate, CATEGORIES } from './supabase.js'

const NAV = ['Home', 'About', 'Skills', 'Projects', 'Education', 'Contact']
const SKILLS = ['Java', 'Flutter', 'Firebase', 'Android', 'Web Technologies', 'Artificial Intelligence', 'Problem Solving']

const Reveal = ({ children, d = 0 }) => (
  <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.6, delay: d }}>{children}</motion.div>
)

function ProjectCard({ p, onOpen }) {
  const thumb = fileUrl('images', p.thumbnail_path)
  const apk = fileUrl('apks', p.apk_path, `${p.name}.apk`)
  return (
    <Reveal>
      <article className="card glass">
        <div className="thumb" onClick={() => onOpen(p)}>
          {thumb ? <img src={thumb} alt={p.name} loading="lazy" /> : <span>{p.name[0]}</span>}
          {p.featured && <em className="badge">Featured</em>}
        </div>
        <small className="cat">{p.category}</small>
        <h3>{p.name}</h3>
        <p className="mut">{p.short_description}</p>
        <div className="chips">{p.tech.map((t) => <span className="chip" key={t}>{t}</span>)}</div>
        <div className="actions">
          <button className="btn ghost sm" onClick={() => onOpen(p)}>Details</button>
          {p.live_url && <a className="btn ghost sm" href={p.live_url} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} /> Live Demo</a>}
          {p.apk_path && <a className="btn sm" href={apk} download><Download size={15} /> Download APK</a>}
        </div>
      </article>
    </Reveal>
  )
}

function Modal({ p, onClose }) {
  const apk = fileUrl('apks', p.apk_path, `${p.name}.apk`)
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal glass" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose} aria-label="Close"><X /></button>
        <small className="cat">{p.category}</small>
        <h2>{p.name}</h2>
        <p className="mut pre">{p.full_description || p.short_description}</p>
        <div className="chips">{p.tech.map((t) => <span className="chip" key={t}>{t}</span>)}</div>
        {p.screenshots.length > 0 && (
          <div className="shots">{p.screenshots.map((s) => <img key={s} src={fileUrl('images', s)} alt={`${p.name} screenshot`} loading="lazy" />)}</div>
        )}
        {p.apk_path && (
          <div className="apkbox">
            <Smartphone />
            <div><b>Android app</b>
              <div className="mut">{[p.apk_version && `v${p.apk_version}`, fmtSize(p.apk_size_bytes), `Updated ${fmtDate(p.updated_at)}`].filter(Boolean).join(' · ')}</div></div>
          </div>
        )}
        <div className="actions">
          {p.apk_path && <a className="btn" href={apk} download><Download size={16} /> Download APK</a>}
          {p.live_url && <a className="btn ghost" href={p.live_url} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} /> Live Demo</a>}
        </div>
      </div>
    </div>
  )
}

function Contact() {
  const [f, setF] = useState({ name: '', email: '', subject: '', message: '' })
  const [st, setSt] = useState({ s: 'idle', m: '' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  async function submit(e) {
    e.preventDefault()
    const v = Object.fromEntries(Object.entries(f).map(([k, x]) => [k, x.trim()]))
    if (!v.name || !v.subject || !v.message) return setSt({ s: 'err', m: 'Please fill in every field.' })
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) return setSt({ s: 'err', m: 'Please enter a valid email address.' })
    setSt({ s: 'busy', m: '' })
    const { error } = await supabase.from('messages').insert(v)
    if (error) setSt({ s: 'err', m: 'Your message could not be sent. Please try again later.' })
    else { setSt({ s: 'ok', m: 'Thank you! Your message was received.' }); setF({ name: '', email: '', subject: '', message: '' }) }
  }
  return (
    <form className="glass form" onSubmit={submit} noValidate>
      <div className="two">
        <label>Name<input value={f.name} onChange={set('name')} maxLength={100} /></label>
        <label>Email<input type="email" value={f.email} onChange={set('email')} maxLength={200} /></label>
      </div>
      <label>Subject<input value={f.subject} onChange={set('subject')} maxLength={150} /></label>
      <label>Message<textarea rows={5} value={f.message} onChange={set('message')} maxLength={5000} /></label>
      <button className="btn" disabled={st.s === 'busy'}><Send size={16} /> {st.s === 'busy' ? 'Sending…' : 'Send Message'}</button>
      {st.m && <p className={st.s === 'ok' ? 'ok' : 'err'}>{st.m}</p>}
    </form>
  )
}

export default function Portfolio() {
  const [projects, setProjects] = useState(null)
  const [error, setError] = useState('')
  const [cat, setCat] = useState('All')
  const [open, setOpen] = useState(null)

  useEffect(() => {
    supabase.from('projects').select('*').eq('status', 'published')
      .order('featured', { ascending: false }).order('updated_at', { ascending: false })
      .then(({ data, error }) => (error ? setError('Could not load projects.') : setProjects(data)))
  }, [])

  const shown = (projects || []).filter((p) => cat === 'All' || p.category === cat)

  return (
    <>
      <div className="aurora"><i /><i /><i /></div>
      <nav className="nav glass">
        <b className="logo">Puneet<span>.</span></b>
        <div>{NAV.map((n) => <a key={n} href={`#${n.toLowerCase()}`}>{n}</a>)}</div>
      </nav>

      <header id="home" className="hero wrap">
        <motion.small initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hello">Hello, I'm</motion.small>
        <motion.h1 initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          <span className="grad">Puneet</span>
        </motion.h1>
        <motion.h2 initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          Software Developer | Java Developer | Aspiring AI Developer
        </motion.h2>
        <motion.p className="mut lead" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          I'm Puneet, a BCA student passionate about software development, modern web technologies, and artificial intelligence. I enjoy building practical applications and turning ideas into digital products.
        </motion.p>
        <div className="actions c">
          <a className="btn" href="#projects">View My Projects</a>
          <a className="btn ghost" href="#contact"><Mail size={16} /> Contact Me</a>
        </div>
      </header>

      <section id="about" className="wrap"><Reveal><h2 className="title">About Me</h2>
        <div className="glass pad"><p className="mut">I am a BCA student who enjoys building practical applications across web and mobile. My work so far includes an e-commerce website, a Flutter and Firebase app for farmers, and an interactive home design project. I am growing my skills in Java and artificial intelligence.</p></div></Reveal></section>

      <section id="skills" className="wrap"><Reveal><h2 className="title">Skills</h2>
        <div className="chips big">{SKILLS.map((s) => <span className="chip" key={s}>{s}</span>)}</div></Reveal></section>

      <section id="projects" className="wrap"><Reveal><h2 className="title">Projects</h2></Reveal>
        <div className="chips filters">
          {['All', ...CATEGORIES].map((c) => <button key={c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c}</button>)}
        </div>
        {error && <p className="err">{error}</p>}
        {!projects && !error && <p className="mut">Loading projects…</p>}
        {projects && !shown.length && <p className="mut">No projects in this category yet.</p>}
        <div className="grid">{shown.map((p) => <ProjectCard key={p.id} p={p} onOpen={setOpen} />)}</div>
      </section>

      <section id="education" className="wrap"><Reveal><h2 className="title">Education</h2>
        <div className="glass pad"><h3>Bachelor of Computer Applications (BCA)</h3><p className="mut">Currently pursuing</p></div></Reveal></section>

      <section id="contact" className="wrap"><Reveal><h2 className="title">Contact</h2><Contact /></Reveal></section>
      <footer>© {new Date().getFullYear()} Puneet Portfolio</footer>
      {open && <Modal p={open} onClose={() => setOpen(null)} />}
    </>
  )
}
