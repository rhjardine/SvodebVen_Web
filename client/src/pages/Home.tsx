import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  ExternalLink,
  FileText,
  Filter,
  Globe2,
  History,
  Landmark,
  Mail,
  MapPin,
  Menu,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

type MemberCategory = "Activo" | "Asociado" | "Estudiante" | "Miembro honorario";

type Member = {
  name: string;
  category: MemberCategory;
  specialty: string;
  location: string;
  bio: string;
  initials: string;
  accent: string;
};

const members: Member[] = [
  {
    name: "Ariana",
    category: "Activo",
    specialty: "Operatoria dental y estética",
    location: "Caracas · Distrito Capital",
    bio: "Miembro de la comunidad científica SVODEB. Perfil en proceso de actualización por secretaría.",
    initials: "AR",
    accent: "from-[#dcecff] to-[#9ac8ef]",
  },
  {
    name: "Krola",
    category: "Asociado",
    specialty: "Biomateriales restauradores",
    location: "Valencia · Carabobo",
    bio: "Integrante asociado con interés en innovación clínica y materiales de nueva generación.",
    initials: "KR",
    accent: "from-[#e9e5ff] to-[#c4baf4]",
  },
  {
    name: "Sara Rodríguez",
    category: "Miembro honorario",
    specialty: "Rehabilitación oral y docencia",
    location: "Maracaibo · Zulia",
    bio: "Miembro honorario. La ficha pública se completará con la reseña curricular aprobada.",
    initials: "SR",
    accent: "from-[#d9f1eb] to-[#9cd9ce]",
  },
  {
    name: "Nueva incorporación",
    category: "Estudiante",
    specialty: "Formación odontológica",
    location: "Venezuela",
    bio: "Espacio reservado para estudiantes que deseen integrarse a la red de educación continua.",
    initials: "+",
    accent: "from-[#f4ead7] to-[#e6c892]",
  },
];

const categories: Array<"Todos" | MemberCategory> = [
  "Todos",
  "Activo",
  "Asociado",
  "Estudiante",
  "Miembro honorario",
];

const navItems = [
  ["Sociedad", "#sociedad"],
  ["Especialistas", "#especialistas"],
  ["Afiliaciones", "#afiliaciones"],
  ["Eventos", "#eventos"],
];

const membershipSteps = [
  ["01", "Completa tu planilla", "Comparte tus datos, formación y área de interés científico."],
  ["02", "Enviamos tu expediente", "La secretaría valida la información y coordina el proceso de admisión."],
  ["03", "Activa tu membresía", "Recibe la confirmación y participa en la comunidad SVODEB."],
];

function LogoMark() {
  return (
    <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#0b2441] text-white shadow-[0_8px_18px_rgba(8,29,55,.18)]">
      <span className="absolute inset-[5px] rounded-[10px] border border-[#80c8f4]/40" />
      <span className="font-display text-[25px] italic leading-none text-[#bce6ff]">S</span>
      <span className="absolute bottom-[7px] right-[8px] h-1.5 w-1.5 rounded-full bg-[#58a5dc]" />
    </span>
  );
}

function SectionHeading({ eyebrow, title, body, light = false }: { eyebrow: string; title: ReactNode; body?: string; light?: boolean }) {
  return (
    <div className={light ? "text-white" : "text-[#102237]"}>
      <div className={light ? "section-kicker !text-[#9dd8f6] before:!bg-[#79c2e8]" : "section-kicker"}>{eyebrow}</div>
      <h2 className="font-display mt-5 max-w-3xl text-[2.65rem] leading-[.98] tracking-[-.035em] sm:text-5xl lg:text-[4.4rem]">
        {title}
      </h2>
      {body && <p className={light ? "mt-6 max-w-2xl text-[1rem] leading-7 text-[#bdcee0]" : "mt-6 max-w-2xl text-[1rem] leading-7 text-[#64788b]"}>{body}</p>}
    </div>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f5f7f9]">
      <header className="absolute left-0 right-0 top-0 z-40 border-b border-white/10 bg-[#071c35]/65 text-white backdrop-blur-xl">
        <div className="container flex h-[76px] items-center justify-between">
          <a href="#inicio" className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
            <LogoMark />
            <span className="hidden leading-[1.05] sm:block">
              <span className="block text-[.72rem] font-extrabold tracking-[.22em] text-white">SVODEB</span>
              <span className="mt-1 block text-[.58rem] tracking-[.1em] text-[#a9c6dc]">Ciencia · Estética · Biomateriales</span>
            </span>
          </a>
          <nav className="hidden items-center gap-7 text-[.72rem] font-bold tracking-[.09em] text-[#c8d8e7] lg:flex">
            {navItems.map(([label, href]) => (
              <a className="transition-colors hover:text-white" href={href} key={href}>{label}</a>
            ))}
            <a className="rounded-full border border-[#8db6d3]/45 px-4 py-2.5 text-white transition hover:border-[#a8dafa] hover:bg-white/10" href="#contacto">Contacto</a>
          </nav>
          <button
            className="rounded-xl border border-white/20 p-2.5 text-white lg:hidden"
            aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {mobileOpen && (
          <nav className="border-t border-white/10 bg-[#071c35]/95 px-5 py-5 lg:hidden">
            <div className="container flex flex-col gap-1">
              {navItems.map(([label, href]) => (
                <a key={href} href={href} onClick={() => setMobileOpen(false)} className="rounded-xl px-3 py-3 text-sm font-semibold text-[#c8d8e7] hover:bg-white/10 hover:text-white">{label}</a>
              ))}
              <a href="#contacto" onClick={() => setMobileOpen(false)} className="mt-2 rounded-xl bg-[#1768b6] px-3 py-3 text-center text-sm font-bold text-white">Contacto</a>
            </div>
          </nav>
        )}
      </header>
      {children}
      <footer className="border-t border-[#dbe3ea] bg-[#061a31] text-white">
        <div className="container grid gap-10 py-14 md:grid-cols-[1.3fr_.7fr_.7fr]">
          <div>
            <div className="flex items-center gap-3"><LogoMark /><div><div className="text-xs font-extrabold tracking-[.22em]">SVODEB</div><div className="mt-1 text-[.62rem] text-[#91abc2]">Sociedad científica venezolana</div></div></div>
            <p className="mt-6 max-w-md text-sm leading-6 text-[#9eb2c6]">Operatoria dental, estética y biomateriales con una mirada científica, humana y contemporánea.</p>
          </div>
          <div>
            <div className="text-[.65rem] font-extrabold uppercase tracking-[.18em] text-[#86c9ee]">Navegación</div>
            <div className="mt-5 grid gap-3 text-sm text-[#bdcee0]"><a href="#sociedad" className="hover:text-white">La sociedad</a><a href="#especialistas" className="hover:text-white">Especialistas</a><a href="#afiliaciones" className="hover:text-white">Afiliaciones</a><a href="#eventos" className="hover:text-white">Eventos científicos</a></div>
          </div>
          <div id="contacto">
            <div className="text-[.65rem] font-extrabold uppercase tracking-[.18em] text-[#86c9ee]">Canales oficiales</div>
            <div className="mt-5 grid gap-3 text-sm text-[#bdcee0]"><a href="mailto:secretaria@svodeb.org" className="flex items-center gap-2 hover:text-white"><Mail size={15} /> secretaria@svodeb.org</a><span className="flex items-center gap-2"><MapPin size={15} /> Venezuela</span><span className="flex items-center gap-2"><Globe2 size={15} /> Afiliada a ALODYB</span></div>
          </div>
        </div>
        <div className="border-t border-white/10"><div className="container flex flex-col gap-2 py-5 text-[.65rem] tracking-[.05em] text-[#7892a9] sm:flex-row sm:items-center sm:justify-between"><span>© 2026 SVODEB · RIF J-296571635</span><span>Una plataforma en evolución para la comunidad odontológica</span></div></div>
      </footer>
    </div>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>("Todos");
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const filteredMembers = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    return members.filter((member) => {
      const matchesQuery = !normalized || [member.name, member.specialty, member.location, member.category].some((value) => value.toLowerCase().includes(normalized));
      const matchesCategory = category === "Todos" || member.category === category;
      return matchesQuery && matchesCategory;
    });
  }, [query, category]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    toast.success("Planilla preparada", { description: "Tu solicitud quedó lista para ser enviada a la secretaría de SVODEB." });
  }

  function handleComingSoon(label: string) {
    toast.info(`${label} · próximamente`, { description: "Esta función quedará habilitada en la siguiente fase del sitio." });
  }

  return (
    <AppShell>
      <main>
        <section id="inicio" className="noise hero-image relative isolate min-h-[720px] overflow-hidden pt-[76px] text-white lg:min-h-[760px]">
          <div className="hero-grid absolute inset-0 opacity-50" />
          <div className="absolute -left-28 top-44 h-72 w-72 rounded-full bg-[#0b5f9b]/25 blur-3xl" />
          <div className="container relative flex min-h-[644px] items-center pb-20 pt-20">
            <div className="max-w-3xl">
              <div className="reveal inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[.07] px-3 py-2 text-[.66rem] font-bold uppercase tracking-[.15em] text-[#b9dcf3] backdrop-blur-md"><span className="h-1.5 w-1.5 rounded-full bg-[#78c9f0] shadow-[0_0_0_4px_rgba(120,201,240,.15)]" /> Sociedad afiliada a ALODYB</div>
              <h1 className="reveal reveal-delay-1 font-display mt-7 max-w-3xl text-[4.2rem] leading-[.91] tracking-[-.045em] text-balance sm:text-[5.7rem] lg:text-[6.8rem]">Ciencia que se convierte en <em className="text-[#9cdbfa]">confianza.</em></h1>
              <p className="reveal reveal-delay-2 mt-8 max-w-xl text-[1.05rem] leading-8 text-[#c0d2e3]">La comunidad venezolana que impulsa la excelencia en operatoria dental, estética y biomateriales.</p>
              <div className="reveal reveal-delay-3 mt-9 flex flex-col gap-3 sm:flex-row">
                <a className="primary-button inline-flex items-center justify-center gap-2 rounded-full bg-[#1872c2] px-6 py-3.5 text-sm font-bold text-white" href="#afiliaciones">Quiero formar parte <ArrowUpRight size={17} /></a>
                <a className="ghost-button inline-flex items-center justify-center gap-2 rounded-full border border-white/30 px-6 py-3.5 text-sm font-bold text-white" href="#especialistas">Explorar especialistas <ArrowRight size={17} /></a>
              </div>
              <div className="mt-14 flex flex-wrap items-center gap-x-8 gap-y-4 text-[.67rem] font-bold uppercase tracking-[.14em] text-[#a7c1d6]"><span className="flex items-center gap-2"><ShieldCheck size={15} className="text-[#85cbed]" /> Rigor científico</span><span className="flex items-center gap-2"><Sparkles size={15} className="text-[#85cbed]" /> Estética responsable</span><span className="flex items-center gap-2"><Globe2 size={15} className="text-[#85cbed]" /> Red nacional</span></div>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#f5f7f9] to-transparent" />
        </section>

        <section className="relative z-10 -mt-8 pb-20">
          <div className="container grid gap-3 sm:grid-cols-3">
            {[["01", "Comunidad", "Un espacio para aprender, compartir y crecer"], ["02", "Actualización", "Educación continua con mirada clínica"], ["03", "Proyección", "Una voz venezolana para la odontología" ]].map(([number, title, text]) => (
              <div key={number} className="surface card-lift rounded-2xl p-5 sm:p-6"><div className="flex items-start justify-between"><span className="text-[.65rem] font-extrabold tracking-[.18em] text-[#6d99ba]">{number}</span><ArrowUpRight size={16} className="text-[#8fa8bc]" /></div><div className="mt-8 text-[1.05rem] font-extrabold text-[#102237]">{title}</div><p className="mt-2 text-[.83rem] leading-5 text-[#718499]">{text}</p></div>
            ))}
          </div>
        </section>

        <section id="sociedad" className="container scroll-mt-24 pb-28">
          <div className="grid gap-14 lg:grid-cols-[.92fr_1.08fr] lg:items-end">
            <SectionHeading eyebrow="La sociedad" title={<>Una práctica más precisa. <em className="text-[#1768b6]">Una comunidad más cercana.</em></>} body="SVODEB nace para conectar a quienes entienden la odontología como una disciplina de precisión, criterio y servicio. Una sociedad científica con identidad venezolana y vocación regional." />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-[#0a2340] p-6 text-white"><History size={22} className="text-[#8cd2f5]" /><div className="mt-10 font-display text-3xl">Nuestra historia</div><p className="mt-3 text-sm leading-6 text-[#a9c1d5]">Un recorrido construido por colegas que decidieron elevar la conversación clínica.</p><a href="#historia" className="mt-6 inline-flex items-center gap-2 text-xs font-bold text-[#9edbfa]">Conocer más <ArrowRight size={15} /></a></div>
              <div className="rounded-2xl border border-[#dbe3ea] bg-white p-6"><Landmark size={22} className="text-[#1768b6]" /><div className="mt-10 font-display text-3xl text-[#102237]">La directiva</div><p className="mt-3 text-sm leading-6 text-[#718499]">La estructura que acompaña el presente y prepara lo que sigue.</p><a href="#directiva" className="mt-6 inline-flex items-center gap-2 text-xs font-bold text-[#1768b6]">Ver comisión <ArrowRight size={15} /></a></div>
            </div>
          </div>
        </section>

        <section id="historia" className="scroll-mt-24 border-y border-[#dbe3ea] bg-white py-24">
          <div className="container grid gap-16 lg:grid-cols-[.62fr_1.38fr]">
            <SectionHeading eyebrow="Reseña histórica" title={<>Un legado que sigue <em className="text-[#1768b6]">tomando forma.</em></>} />
            <div className="relative border-l border-[#bdd0df] pl-7 sm:pl-10">
              <div className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full bg-[#1768b6] ring-4 ring-[#dcecff]" />
              <span className="text-[.68rem] font-extrabold uppercase tracking-[.18em] text-[#1768b6]">Origen</span>
              <h3 className="mt-4 text-2xl font-extrabold tracking-[-.02em] text-[#102237]">La excelencia clínica se construye en comunidad.</h3>
              <p className="mt-5 max-w-2xl text-[1rem] leading-8 text-[#66788a]">La Sociedad Venezolana de Operatoria Dental, Estética y Biomateriales reúne a profesionales y estudiantes alrededor de una visión compartida: promover la actualización científica, el intercambio honesto y una práctica clínica sensible a la persona.</p>
              <p className="mt-4 max-w-2xl text-[1rem] leading-8 text-[#66788a]">Este espacio digital es el primer capítulo de una plataforma que crecerá con la memoria de sus fundadores, la voz de sus miembros y el rigor de las nuevas generaciones.</p>
              <div className="mt-9 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-[#f1f6fa] p-4"><div className="text-xl font-extrabold text-[#102237]">01</div><div className="mt-1 text-xs leading-5 text-[#718499]">Identidad científica</div></div><div className="rounded-xl bg-[#f1f6fa] p-4"><div className="text-xl font-extrabold text-[#102237]">02</div><div className="mt-1 text-xs leading-5 text-[#718499]">Educación continua</div></div><div className="rounded-xl bg-[#f1f6fa] p-4"><div className="text-xl font-extrabold text-[#102237]">03</div><div className="mt-1 text-xs leading-5 text-[#718499]">Red profesional</div></div></div>
            </div>
          </div>
        </section>

        <section id="directiva" className="container scroll-mt-24 py-28">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end"><SectionHeading eyebrow="Comisión directiva" title="Las personas detrás del propósito." body="Un módulo preparado para desplegar cargos, trayectoria, áreas de investigación y publicaciones destacadas." /><button onClick={() => handleComingSoon("Ficha institucional")} className="ghost-button inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-[#b7cfdf] px-5 py-3 text-xs font-bold text-[#1768b6]">Ver estructura completa <ExternalLink size={15} /></button></div>
          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {[{name:"Ariana", role:"Presidencia", detail:"Dirección científica y representación institucional", tone:"#dcecff"},{name:"Krola", role:"Secretaría", detail:"Gestión de miembros y educación continua", tone:"#e9e5ff"},{name:"Sara Rodríguez", role:"Comité de credenciales", detail:"Acompañamiento de nuevas incorporaciones", tone:"#d9f1eb"}].map((person) => (
              <div key={person.name} className="card-lift rounded-2xl border border-[#dbe3ea] bg-white p-5"><div className="flex items-center gap-4"><div className="flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-extrabold text-[#174c78]" style={{background: person.tone}}>{person.name.split(" ").map((part) => part[0]).join("").slice(0,2)}</div><div><div className="text-lg font-extrabold text-[#102237]">{person.name}</div><div className="mt-1 text-[.67rem] font-extrabold uppercase tracking-[.13em] text-[#1768b6]">{person.role}</div></div></div><p className="mt-6 border-t border-[#edf1f4] pt-5 text-sm leading-6 text-[#718499]">{person.detail}</p></div>
            ))}
          </div>
        </section>

        <section id="especialistas" className="scroll-mt-24 bg-[#edf3f7] py-28">
          <div className="container">
            <div className="grid gap-12 lg:grid-cols-[.73fr_1.27fr] lg:items-start">
              <div><SectionHeading eyebrow="Directorio oficial" title={<>La red clínica, <em className="text-[#1768b6]">a tu alcance.</em></>} body="Busca por nombre, ubicación o categoría. Cada ficha puede crecer con credencial, contacto profesional y áreas de práctica." /><div className="mt-8 flex items-center gap-3 text-[.68rem] font-bold uppercase tracking-[.12em] text-[#7990a3]"><BadgeCheck size={17} className="text-[#1768b6]" /> Nómina inicial de demostración</div></div>
              <div className="surface rounded-3xl p-4 sm:p-6">
                <div className="flex flex-col gap-3 border-b border-[#e4ebf0] pb-5 sm:flex-row"><label className="relative flex-1"><Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8ba0b1]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar especialista, ciudad o área" className="h-12 w-full rounded-xl border border-[#dbe3ea] bg-[#f8fafb] pl-11 pr-4 text-sm text-[#102237] outline-none transition placeholder:text-[#9aabba] focus:border-[#77acd3] focus:ring-4 focus:ring-[#dcecff]" /></label><div className="relative"><Filter size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8ba0b1]" /><select value={category} onChange={(event) => setCategory(event.target.value as (typeof categories)[number])} className="h-12 w-full appearance-none rounded-xl border border-[#dbe3ea] bg-[#f8fafb] pl-10 pr-9 text-sm font-semibold text-[#324b63] outline-none focus:border-[#77acd3] sm:w-[205px]"><option value="Todos">Todas las categorías</option>{categories.slice(1).map((item) => <option key={item} value={item}>{item}</option>)}</select><ChevronDown size={15} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#8ba0b1]" /></div></div>
                <div className="divide-y divide-[#edf1f4]">
                  {filteredMembers.length ? filteredMembers.map((member) => { const isOpen = expandedMember === member.name; return <div key={member.name} className="py-5 first:pt-6 last:pb-2"><button className="flex w-full items-center justify-between gap-4 text-left" onClick={() => setExpandedMember(isOpen ? null : member.name)} aria-expanded={isOpen}><div className="flex min-w-0 items-center gap-3"><div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${member.accent} text-xs font-extrabold text-[#16466d]`}>{member.initials}</div><div className="min-w-0"><div className="truncate text-sm font-extrabold text-[#102237]">{member.name}</div><div className="mt-1 truncate text-xs text-[#718499]">{member.specialty} · {member.location}</div></div></div><div className="flex shrink-0 items-center gap-3"><span className="hidden rounded-full bg-[#e5f3eb] px-3 py-1.5 text-[.63rem] font-extrabold text-[#247347] sm:block">{member.category}</span>{isOpen ? <ChevronUp size={17} className="text-[#1768b6]" /> : <ChevronDown size={17} className="text-[#8ba0b1]" />}</div></button>{isOpen && <div className="ml-14 mt-4 rounded-xl bg-[#f4f8fb] p-4 text-sm leading-6 text-[#66788a]"><div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white px-2.5 py-1 text-[.62rem] font-extrabold uppercase tracking-[.1em] text-[#1768b6] sm:hidden"><BadgeCheck size={12} /> {member.category}</div><p>{member.bio}</p><button onClick={() => handleComingSoon("Contacto profesional")} className="mt-3 inline-flex items-center gap-1.5 text-xs font-extrabold text-[#1768b6]">Solicitar contacto validado <ArrowRight size={14} /></button></div>}</div>; }) : <div className="py-12 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eaf2f8]"><Search size={20} className="text-[#6f9bc1]" /></div><div className="mt-4 text-sm font-extrabold text-[#102237]">No encontramos coincidencias</div><p className="mt-1 text-xs text-[#718499]">Prueba con otra ciudad, categoría o nombre.</p></div>}
                </div>
                <div className="mt-5 flex items-center justify-between rounded-xl bg-[#f5f8fa] px-4 py-3 text-[.68rem] font-semibold text-[#718499]"><span>{filteredMembers.length} registros visibles</span><button onClick={() => handleComingSoon("Carga de miembros")} className="font-extrabold text-[#1768b6]">¿Eres miembro? Actualiza tu ficha <ArrowRight className="ml-1 inline" size={13} /></button></div>
              </div>
            </div>
          </div>
        </section>

        <section id="afiliaciones" className="scroll-mt-24 bg-[#08213d] py-28 text-white">
          <div className="container grid gap-14 lg:grid-cols-[.85fr_1.15fr]">
            <div><SectionHeading light eyebrow="Afiliaciones" title={<>Tu siguiente capítulo <em className="text-[#9cdbfa]">empieza aquí.</em></>} body="La planilla está pensada para recopilar la información esencial de forma clara. En la siguiente fase, se conectará a un flujo seguro de expedientes y validación." /><div className="mt-10 grid gap-4">{membershipSteps.map(([number, title, text]) => <div key={number} className="flex gap-4"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#5687ab] text-[.65rem] font-extrabold text-[#9cdbfa]">{number}</div><div><div className="text-sm font-extrabold text-white">{title}</div><div className="mt-1 text-xs leading-5 text-[#9eb6ca]">{text}</div></div></div>)}</div></div>
            <form onSubmit={handleSubmit} className="rounded-3xl bg-white p-5 text-[#102237] shadow-[0_28px_80px_rgba(0,0,0,.18)] sm:p-8"><div className="flex items-start justify-between gap-5"><div><div className="text-[.68rem] font-extrabold uppercase tracking-[.16em] text-[#1768b6]">Planilla de postulación</div><h3 className="mt-2 font-display text-3xl tracking-[-.02em]">Comencemos tu registro.</h3></div><ClipboardList className="text-[#77afd5]" size={26} /></div>{submitted ? <div className="mt-8 rounded-2xl border border-[#b6dfc4] bg-[#edf9f0] p-6"><CheckCircle2 size={26} className="text-[#2a8b4d]" /><div className="mt-4 font-extrabold text-[#1f6138]">Solicitud preparada</div><p className="mt-2 text-sm leading-6 text-[#4d7560]">Gracias por dar el primer paso. La secretaría de SVODEB revisará tus datos y te contactará para continuar.</p><button type="button" onClick={() => setSubmitted(false)} className="mt-5 text-xs font-extrabold text-[#1768b6]">Crear otra solicitud</button></div> : <><div className="mt-8 grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-xs font-bold text-[#52687b]">Nombre y apellido<input required name="name" placeholder="Ej. Dra. María Pérez" className="h-11 rounded-xl border border-[#dbe3ea] bg-[#fbfcfd] px-3 text-sm font-medium text-[#102237] outline-none focus:border-[#77acd3] focus:ring-4 focus:ring-[#dcecff]" /></label><label className="grid gap-2 text-xs font-bold text-[#52687b]">Correo electrónico<input required type="email" name="email" placeholder="nombre@correo.com" className="h-11 rounded-xl border border-[#dbe3ea] bg-[#fbfcfd] px-3 text-sm font-medium text-[#102237] outline-none focus:border-[#77acd3] focus:ring-4 focus:ring-[#dcecff]" /></label><label className="grid gap-2 text-xs font-bold text-[#52687b]">Ciudad / Estado<input name="location" placeholder="Caracas, Miranda" className="h-11 rounded-xl border border-[#dbe3ea] bg-[#fbfcfd] px-3 text-sm font-medium text-[#102237] outline-none focus:border-[#77acd3] focus:ring-4 focus:ring-[#dcecff]" /></label><label className="grid gap-2 text-xs font-bold text-[#52687b]">Perfil de ingreso<select required name="profile" className="h-11 rounded-xl border border-[#dbe3ea] bg-[#fbfcfd] px-3 text-sm font-medium text-[#102237] outline-none focus:border-[#77acd3] focus:ring-4 focus:ring-[#dcecff]"><option value="">Selecciona una opción</option><option>Miembro activo</option><option>Miembro asociado</option><option>Estudiante</option><option>Miembro honorario</option></select></label></div><label className="mt-4 grid gap-2 text-xs font-bold text-[#52687b]">Cuéntanos brevemente sobre tu interés<textarea required name="message" rows={3} placeholder="Área clínica, formación o motivación para integrarte…" className="resize-none rounded-xl border border-[#dbe3ea] bg-[#fbfcfd] p-3 text-sm font-medium text-[#102237] outline-none focus:border-[#77acd3] focus:ring-4 focus:ring-[#dcecff]" /></label><div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><span className="flex items-center gap-2 text-[.68rem] leading-4 text-[#8293a0]"><Check size={15} className="shrink-0 text-[#2a8b4d]" /> Tus datos serán revisados por secretaría</span><button className="primary-button inline-flex items-center justify-center gap-2 rounded-full bg-[#1768b6] px-5 py-3 text-xs font-extrabold text-white" type="submit">Enviar planilla <Send size={14} /></button></div></>}</form>
          </div>
        </section>

        <section id="eventos" className="container scroll-mt-24 py-28">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end"><SectionHeading eyebrow="Eventos y educación continua" title={<>Aprender juntos cambia <em className="text-[#1768b6]">la práctica.</em></>} body="Un calendario vivo para jornadas, cursos y congresos organizados por la sociedad." /><button onClick={() => handleComingSoon("Calendario completo")} className="ghost-button inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-[#b7cfdf] px-5 py-3 text-xs font-bold text-[#1768b6]">Ver todos los eventos <ArrowRight size={15} /></button></div>
          <div className="mt-14 grid gap-5 lg:grid-cols-[1.16fr_.84fr]">
            <div className="relative overflow-hidden rounded-3xl bg-[#0b294b] p-7 text-white sm:p-10"><div className="absolute -right-16 -top-16 h-64 w-64 rounded-full border border-[#75c6ee]/20" /><div className="absolute -right-5 -top-5 h-44 w-44 rounded-full border border-[#75c6ee]/15" /><div className="relative max-w-xl"><div className="inline-flex items-center gap-2 rounded-full bg-[#185987] px-3 py-1.5 text-[.63rem] font-extrabold uppercase tracking-[.15em] text-[#bfe9fb]"><Sparkles size={13} /> Próximamente</div><h3 className="font-display mt-8 text-4xl leading-[1.02] tracking-[-.03em] sm:text-5xl">Jornadas SVODEB<br /><em className="text-[#9cdbfa]">2026</em></h3><p className="mt-5 max-w-md text-sm leading-6 text-[#afc7da]">Un nuevo encuentro para conversar sobre protocolos, materiales y el futuro de la estética dental.</p><button onClick={() => handleComingSoon("Registro a las Jornadas SVODEB 2026")} className="primary-button mt-8 inline-flex items-center gap-2 rounded-full bg-[#e4f5ff] px-5 py-3 text-xs font-extrabold text-[#0b426e]">Quiero recibir información <ArrowUpRight size={15} /></button></div></div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1"><div className="card-lift rounded-3xl border border-[#dbe3ea] bg-white p-6"><div className="flex items-center justify-between"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e4f1fb] text-[#1768b6]"><BookOpen size={21} /></div><span className="rounded-full bg-[#edf6ff] px-3 py-1.5 text-[.62rem] font-extrabold uppercase tracking-[.1em] text-[#1768b6]">Educación</span></div><h4 className="mt-7 text-lg font-extrabold text-[#102237]">Cursos y actualización</h4><p className="mt-2 text-sm leading-6 text-[#718499]">Formación continua diseñada para volver a la clínica con nuevas preguntas.</p><button onClick={() => handleComingSoon("Cursos y actualización")} className="mt-5 inline-flex items-center gap-2 text-xs font-extrabold text-[#1768b6]">Explorar agenda <ArrowRight size={14} /></button></div><div className="card-lift rounded-3xl border border-[#dbe3ea] bg-white p-6"><div className="flex items-center justify-between"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e7f5f1] text-[#238169]"><CircleDollarSign size={21} /></div><span className="rounded-full bg-[#edf8f4] px-3 py-1.5 text-[.62rem] font-extrabold uppercase tracking-[.1em] text-[#238169]">Fase futura</span></div><h4 className="mt-7 text-lg font-extrabold text-[#102237]">Inscripción simplificada</h4><p className="mt-2 text-sm leading-6 text-[#718499]">Próximamente podrás pagar tu inscripción y reservar eventos en un mismo lugar.</p><button onClick={() => handleComingSoon("Botón de pago")} className="mt-5 inline-flex items-center gap-2 text-xs font-extrabold text-[#1768b6]">Conocer la hoja de ruta <ArrowRight size={14} /></button></div></div>
          </div>
        </section>

        <section className="border-t border-[#dbe3ea] bg-[#f0f5f8] py-20">
          <div className="container grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center"><div><div className="section-kicker">Información para inscripciones</div><h2 className="font-display mt-5 max-w-2xl text-4xl leading-[1] tracking-[-.03em] text-[#102237] sm:text-5xl">Todo lo necesario para dar el primer paso.</h2></div><div className="grid max-w-xl gap-3 sm:grid-cols-2"><div className="flex gap-3 rounded-2xl bg-white p-4"><FileText size={18} className="mt-0.5 shrink-0 text-[#1768b6]" /><div><div className="text-sm font-extrabold text-[#102237]">Requisitos</div><div className="mt-1 text-xs leading-5 text-[#718499]">Datos personales, formación y área de interés.</div></div></div><div className="flex gap-3 rounded-2xl bg-white p-4"><Clock3 size={18} className="mt-0.5 shrink-0 text-[#1768b6]" /><div><div className="text-sm font-extrabold text-[#102237]">Respuesta</div><div className="mt-1 text-xs leading-5 text-[#718499]">La secretaría te contactará para continuar.</div></div></div></div></div>
        </section>
      </main>
    </AppShell>
  );
}
