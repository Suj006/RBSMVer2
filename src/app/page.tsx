import Link from "next/link";
import {
  Armchair, ArrowRight, BadgeCheck, BarChart3, Building2, CalendarClock, ChevronDown, ClipboardCheck, Coffee, Cog, Cpu, FileSpreadsheet,
  Fish, FlaskConical, Footprints, Gem, Globe2, Handshake, KeyRound, Landmark, Leaf, LogIn, Mail, MapPin, Package, Palette, Pill,
  Puzzle, Scissors, Shirt, ShieldCheck, Sparkles, Sprout, Store, Target, Trees, UserPlus, Users, Wheat, Zap, Nut, Droplets, BrickWall, Soup,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { Globe } from "@/components/landing/globe";
import { EVENT } from "@/lib/config";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/status";
import { landingStats } from "@/lib/landing";
import { cn } from "@/lib/cn";

// Sector icons are matched on keywords so new sectors added by the admin still get a sensible icon.
const SECTOR_ICONS: [RegExp, LucideIcon][] = [
  [/spice/i, Leaf], [/tea|coffee/i, Coffee], [/cashew|dry fruit/i, Nut], [/marine|seafood/i, Fish], [/processed food|beverage/i, Soup],
  [/agri/i, Wheat], [/coir/i, Sprout], [/handloom|textile/i, Scissors], [/apparel|garment/i, Shirt], [/handicraft|decor/i, Palette],
  [/bamboo|wood/i, Trees], [/furniture/i, Armchair], [/rubber/i, Droplets], [/ayurveda|herbal|wellness/i, Leaf], [/pharma|health/i, Pill],
  [/cosmetic|personal care/i, Sparkles], [/chemical|plastic/i, FlaskConical], [/engineering|capital/i, Cog], [/electric|electronic/i, Zap],
  [/software|IT /i, Cpu], [/leather|footwear/i, Footprints], [/gem|jewel/i, Gem], [/paper|packag/i, Package], [/building|construction/i, BrickWall],
  [/toy|sport/i, Puzzle],
];
const sectorIcon = (name: string) => SECTOR_ICONS.find(([re]) => re.test(name))?.[1] ?? Package;
const ACCENTS = ["text-tx-green bg-tx-green/10", "text-tx-blue bg-tx-blue/10", "text-[#a8930f] bg-tx-yellow/15", "text-tx-red bg-tx-red/10"];

const BUYER_STEPS = [
  { icon: UserPlus, title: "Sign up in a minute", body: "Country, organisation name and e-mail. Your login is e-mailed to you straight away." },
  { icon: Building2, title: "Complete one application", body: "Point of contact, company documents and sourcing profile." },
  { icon: ClipboardCheck, title: "Tell us what you source", body: "Sector by sector: products, specifications, certifications and volumes — submitted with your application." },
  { icon: ShieldCheck, title: "Verified by FIEO", body: "FIEO verifies your organisation and each sector in one review." },
  { icon: BadgeCheck, title: "Approved by the Directorate", body: "You receive your RBSM buyer number and are matched with suppliers." },
];
const SELLER_STEPS = [
  { icon: Store, title: "Register your enterprise", body: "Self-register online and get a login to track your application — or register through your District Industries Centre." },
  { icon: Landmark, title: "Verified by your district centre", body: "Udyam number, IEC, certifications and contact details are checked locally. If anything needs correcting, you fix it yourself online." },
  { icon: BadgeCheck, title: "Approved by the Directorate", body: "You receive your RBSM seller number; your login becomes your permanent seller login, where you complete your seller profile." },
  { icon: Handshake, title: "Choose buyers, then meet them", body: "See approved buyers' requirements, name up to five preferred buyers, and get your published meeting list." },
];
const MODULES = [
  { icon: Users, title: "Buyer registration & profiling", body: "Structured buyer profiles with sourcing value, timelines and sector-wise requirements.", tone: "bg-tx-blue", live: true },
  { icon: Store, title: "MSME seller registry", body: "Sellers from all 14 districts — individual entry, Excel bulk upload or self-registration.", tone: "bg-tx-green", live: true },
  { icon: ShieldCheck, title: "Two-level verification", body: "FIEO and the Directorate approve buyers sector by sector; district centres verify sellers.", tone: "bg-tx-yellow", live: true },
  { icon: BarChart3, title: "Sector demand intelligence", body: "Which products buyers want in every sector — and which approved sellers offer them.", tone: "bg-tx-red", live: true },
  { icon: Handshake, title: "Buyer–seller matchmaking", body: "Sellers state their preferred buyers; the Directorate maps each buyer to ten relevant sellers using preferences and sector–product fit.", tone: "bg-tx-green", live: true },
  { icon: CalendarClock, title: "B2B meetings & follow-up", body: "One-to-one meeting schedules during the event, then leads, MoUs and outcomes.", tone: "bg-tx-blue", live: false },
];
const OFFICIAL = [
  { title: "Directorate of Industries & Commerce", body: "Final approvals, targets and programme MIS", icon: Landmark },
  { title: "FIEO", body: "Buyer verification and recommendations", icon: Globe2 },
  { title: "District Industries Centres", body: "Seller registration and recommendation — 14 districts", icon: MapPin },
  { title: "Portal administration", body: "Sector and certification masters, users", icon: KeyRound },
];
const FAQ = [
  { q: "Who can register as a buyer?", a: "International importers, distributors, retailers and sourcing companies looking to buy from Indian MSMEs. Registration is free; FIEO verifies every buyer before the Directorate approves them." },
  { q: "Who can register as a seller?", a: "MSMEs located in Kerala with a valid Udyam registration (UDYAM-KL-…). You can register online yourself or through your District Industries Centre." },
  { q: "How are buyers and sellers matched?", a: "On the sectors and products each buyer needs and each seller is ready to export, the certifications buyers ask for, and sellers' own preferences. The aim is for every buyer to meet at least ten relevant sellers." },
  { q: "I registered but have not received my login.", a: "Buyers receive their login immediately after sign-up — please check your spam folder. Sellers who register online also receive a login immediately, to track the application and make corrections; it becomes the permanent seller login on approval." },
  { q: "My district centre asked for a correction. What do I do?", a: "Sign in with the login e-mailed to you, correct the details shown on your application page and click \u201cSave & submit to district centre\u201d. The district centre's comment is shown at the top of the page." },
  { q: "Can I change my requirement after approval?", a: "Yes. Approved buyers can modify a sector or add new sectors at any time; the change goes through the same verification." },
];

export default async function Home() {
  const [user, stats] = await Promise.all([getCurrentUser(), landingStats()]);
  const sectorsWithSellers = stats.sectors.filter((s) => s.sellers > 0).length;
  const northToSouth = [...stats.districts].reverse();
  const maxDistrict = Math.max(1, ...stats.districts.map((d) => d.sellers));
  const nav = [["#programme", "Programme"], ["#buyers", "Buyers"], ["#sellers", "Sellers"], ["#sectors", "Sectors"], ["#districts", "Districts"], ["#faq", "FAQ"]];

  return (
    <div className="bg-white text-ink">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-ink/90 text-white backdrop-blur-md">
        <div className="tx-ribbon h-1" />
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="rounded-lg bg-white px-2.5 py-1.5" aria-label={`${EVENT.name} home`}><Logo withText={false} /></Link>
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Sections">
            {nav.map(([h, l]) => <a key={h} href={h} className="rounded-lg px-3 py-2 text-sm font-medium text-white/75 hover:bg-white/10 hover:text-white">{l}</a>)}
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <Link href={ROLE_HOME[user.role]} className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
                My dashboard <ArrowRight className="size-4" />
              </Link>
            ) : (
              <>
                <Link href="/login" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white/90 ring-1 ring-white/25 hover:bg-white/10">
                  <LogIn className="size-4" /> Sign in
                </Link>
                <a href="#register" className="hidden items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 sm:inline-flex">Register</a>
              </>
            )}
            <details className="relative lg:hidden">
              <summary className="grid size-9 cursor-pointer list-none place-items-center rounded-lg ring-1 ring-white/25 [&::-webkit-details-marker]:hidden" aria-label="Menu">
                <ChevronDown className="size-4" />
              </summary>
              <div className="absolute right-0 mt-2 w-52 rounded-xl bg-white p-2 text-ink shadow-xl ring-1 ring-slate-200">
                {nav.map(([h, l]) => <a key={h} href={h} className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-50">{l}</a>)}
                <a href="#register" className="mt-1 block rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white">Register</a>
              </div>
            </details>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-ink text-white">
        <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:44px_44px]" aria-hidden />
        <div className="absolute -left-40 top-20 size-[520px] rounded-full bg-tx-blue/20 blur-[120px]" aria-hidden />
        <div className="absolute -right-24 bottom-0 size-[460px] rounded-full bg-tx-green/25 blur-[120px]" aria-hidden />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pb-24 lg:pt-20">
          <div>
            <div className="inline-flex flex-wrap items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-white/85 ring-1 ring-white/15">
              <span className="flex gap-0.5" aria-hidden>
                <span className="size-1.5 rounded-full bg-tx-red" /><span className="size-1.5 rounded-full bg-tx-yellow" />
                <span className="size-1.5 rounded-full bg-tx-green" /><span className="size-1.5 rounded-full bg-tx-blue" />
              </span>
              {EVENT.organiser}, Government of Kerala
            </div>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.04] tracking-tight sm:text-6xl lg:text-[4.1rem]">
              Where the world <br className="hidden sm:block" />sources from{" "}
              <span className="bg-gradient-to-r from-tx-green via-tx-yellow to-tx-blue bg-clip-text text-transparent">Kerala.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">
              <span className="font-semibold text-white">{EVENT.name} {EVENT.programme}</span> brings verified international buyers
              face to face with export-ready MSMEs from all 14 districts of Kerala — through structured, data-driven B2B matchmaking.
            </p>
            <div className="mt-9 grid scroll-mt-28 gap-3 sm:grid-cols-2" id="register">
              <Link href="/signup" className="group relative overflow-hidden rounded-2xl bg-white p-5 text-ink shadow-lg ring-1 ring-white/20 transition hover:-translate-y-0.5">
                <span className="absolute inset-x-0 top-0 h-1 bg-tx-blue" />
                <Globe2 className="size-6 text-tx-blue" />
                <div className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-500">International buyer</div>
                <div className="mt-0.5 flex items-center justify-between text-lg font-bold">Register to source <ArrowRight className="size-5 transition group-hover:translate-x-1" /></div>
              </Link>
              <Link href="/seller-register" className="group relative overflow-hidden rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/20 transition hover:-translate-y-0.5 hover:bg-white/10">
                <span className="absolute inset-x-0 top-0 h-1 bg-tx-green" />
                <Store className="size-6 text-tx-green" />
                <div className="mt-3 text-xs font-bold uppercase tracking-wider text-white/55">Kerala MSME seller</div>
                <div className="mt-0.5 flex items-center justify-between text-lg font-bold">Register to export <ArrowRight className="size-5 transition group-hover:translate-x-1" /></div>
              </Link>
            </div>
            <p className="mt-5 text-sm text-white/50">
              Already registered or an official user? <Link href="/login" className="font-semibold text-white underline-offset-4 hover:underline">Sign in</Link>
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-[520px]">
            <Globe />
            <div className="absolute left-0 top-[12%] hidden rounded-xl bg-white/95 px-3.5 py-2.5 text-ink shadow-xl sm:block">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Buyer countries</div>
              <div className="text-xl font-extrabold">{stats.countries}</div>
            </div>
            <div className="absolute bottom-[10%] right-0 hidden rounded-xl bg-white/95 px-3.5 py-2.5 text-ink shadow-xl sm:block">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Kerala · India</div>
              <div className="flex items-center gap-1.5 text-sm font-bold"><MapPin className="size-4 text-tx-green" /> 14 districts, one marketplace</div>
            </div>
          </div>
        </div>

        {/* Live figures */}
        <div className="relative border-t border-white/10 bg-white/[0.03]">
          <dl className="mx-auto grid max-w-7xl grid-cols-2 divide-white/10 px-4 sm:px-6 lg:grid-cols-4 lg:divide-x">
            {[
              { k: "International buyers", v: stats.buyers, sub: `${stats.approvedBuyers} approved · target ${stats.targets.buyers}`, c: "bg-tx-blue" },
              { k: "Buyer countries", v: stats.countries, sub: "and growing", c: "bg-tx-yellow" },
              { k: "Kerala MSME sellers", v: stats.sellers, sub: `${stats.approvedSellers} approved · target ${stats.targets.sellers}`, c: "bg-tx-green" },
              { k: "Export sectors", v: stats.sectors.length, sub: `${stats.targets.sellersPerBuyer}+ sellers per buyer`, c: "bg-tx-red" },
            ].map((s) => (
              <div key={s.k} className="px-2 py-6 lg:px-8">
                <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/55"><span className={cn("h-3 w-1 shrink-0 rounded", s.c)} />{s.k}</dt>
                <dd className="mt-2 text-3xl font-extrabold tabular-nums sm:text-4xl">{s.v.toLocaleString("en-IN")}</dd>
                <dd className="mt-1 text-xs text-white/50">{s.sub}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Partners */}
      <section className="border-b border-slate-100 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-4 py-6 text-sm font-semibold text-slate-500 sm:px-6">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">In partnership</span>
          <span className="inline-flex items-center gap-2"><Landmark className="size-4 text-brand-700" /> {EVENT.organiser}</span>
          <span className="inline-flex items-center gap-2"><Globe2 className="size-4 text-tx-blue" /> {EVENT.partner}</span>
          <span className="inline-flex items-center gap-2"><MapPin className="size-4 text-tx-red" /> 14 District Industries Centres</span>
        </div>
      </section>

      {/* Programme */}
      <section id="programme" className="scroll-mt-20 py-20 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.15fr] lg:items-center">
          <div>
            <Eyebrow>The programme</Eyebrow>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">A reverse buyer–seller meet, <br className="hidden sm:block" />built on data</h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              Instead of exporters travelling abroad, international buyers come to Kerala. Every buyer is verified and every requirement
              is captured sector by sector, so each meeting is with a supplier that makes what the buyer needs.
            </p>
            <ul className="mt-8 space-y-4">
              {([
                [Target, `${stats.targets.buyers} international buyers and ${stats.targets.sellers} Kerala MSMEs`],
                [Handshake, `At least ${stats.targets.sellersPerBuyer} pre-matched one-to-one meetings for every buyer`],
                [ShieldCheck, "Verification by FIEO, district centres and the Directorate"],
                [FileSpreadsheet, "Live dashboards and downloadable reports for every stakeholder"],
              ] as [LucideIcon, string][]).map(([Icon, t]) => (
                <li key={t} className="flex items-start gap-3">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700"><Icon className="size-4" /></span>
                  <span className="pt-1 text-slate-700">{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {MODULES.map((m) => (
              <div key={m.title} className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition hover:shadow-md">
                <span className={cn("absolute inset-x-0 top-0 h-1", m.tone)} />
                <div className="flex items-start justify-between gap-2">
                  <m.icon className="size-6 text-ink" />
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1",
                    m.live ? "bg-brand-50 text-brand-800 ring-brand-200" : "bg-slate-50 text-slate-500 ring-slate-200")}>{m.live ? "Live" : "Coming next"}</span>
                </div>
                <h3 className="mt-4 font-bold">{m.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{m.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Two journeys */}
      <section className="bg-canvas py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow center>How it works</Eyebrow>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Two doors, one marketplace</h2>
            <p className="mt-3 text-slate-600">Separate, simple journeys for buyers and sellers — both ending at the same table.</p>
          </div>
          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <Journey id="buyers" tone="blue" icon={Globe2} label="For international buyers" title="Source verified products from Kerala"
              steps={BUYER_STEPS} cta={{ href: "/signup", label: "Register as a buyer" }} />
            <Journey id="sellers" tone="green" icon={Store} label="For Kerala MSMEs" title="Meet buyers without leaving Kerala"
              steps={SELLER_STEPS} cta={{ href: "/seller-register", label: "Register as a seller" }}
              note="Keep your Udyam registration (UDYAM-KL-…), IEC number (if you export) and certificates ready. Your District Industries Centre can also register you." />
          </div>
        </div>
      </section>

      {/* Sectors */}
      <section id="sectors" className="scroll-mt-20 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-2xl">
              <Eyebrow>Sectors</Eyebrow>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">{stats.sectors.length} sectors, from spices to software</h2>
              <p className="mt-3 text-slate-600">Kerala&apos;s export strengths — with live counts of approved sellers ready to export in each sector.</p>
            </div>
            <div className="text-sm text-slate-500">{sectorsWithSellers} of {stats.sectors.length} sectors already have approved sellers</div>
          </div>
          <ul className="mt-10 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
            {stats.sectors.map((s, i) => {
              const Icon = sectorIcon(s.name);
              return (
                <li key={s.id} className="flex flex-col gap-2 rounded-xl bg-white p-3 ring-1 sm:flex-row sm:items-center sm:gap-3 sm:p-3.5 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md">
                  <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg sm:size-10", ACCENTS[i % ACCENTS.length])}><Icon className="size-5" /></span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold leading-snug">{s.name}</div>
                    <div className="text-xs text-slate-500">{s.sellers ? `${s.sellers} seller${s.sellers > 1 ? "s" : ""} ready` : "Open for sellers"}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Districts */}
      <section id="districts" className="relative scroll-mt-20 overflow-hidden bg-ink py-20 text-white sm:py-24">
        <div className="absolute -right-32 top-0 size-[420px] rounded-full bg-tx-green/20 blur-[120px]" aria-hidden />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div>
            <Eyebrow dark>All of Kerala</Eyebrow>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">14 districts. One export network.</h2>
            <p className="mt-4 text-lg leading-relaxed text-white/70">
              Every District Industries Centre registers and verifies sellers from its district, so buyers meet enterprises from
              Kasaragod to Thiruvananthapuram — from coastal seafood processors to high-range spice and tea growers.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-4 sm:max-w-md">
              <div className="rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/10">
                <div className="text-3xl font-extrabold tabular-nums">{stats.approvedSellers}</div>
                <div className="mt-1 text-sm text-white/60">approved sellers</div>
              </div>
              <div className="rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/10">
                <div className="text-3xl font-extrabold tabular-nums">{stats.districts.filter((d) => d.sellers).length}<span className="text-lg text-white/50"> / 14</span></div>
                <div className="mt-1 text-sm text-white/60">districts represented</div>
              </div>
            </div>
          </div>
          <div>
            <ol className="grid gap-x-8 sm:grid-flow-col sm:grid-cols-2 sm:grid-rows-7">
              {northToSouth.map((d, i) => (
                <li key={d.name} className="flex items-center gap-3 border-b border-white/10 py-2.5">
                                    <span className={cn("size-2.5 shrink-0 rounded-full", ["bg-tx-red", "bg-tx-yellow", "bg-tx-green", "bg-tx-blue"][i % 4])} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{d.name}</span>
                  <span className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-white/10 sm:block" aria-hidden>
                    <span className="block h-full rounded-full bg-tx-green" style={{ width: `${(d.sellers / maxDistrict) * 100}%` }} />
                  </span>
                  <span className="w-8 text-right text-sm font-semibold tabular-nums text-white/80">{d.sellers}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs text-white/40">North to south · approved sellers per district</p>
          </div>
        </div>
      </section>

      {/* Official portals */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-2xl">
              <Eyebrow>Official portals</Eyebrow>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">One platform for every stakeholder</h2>
              <p className="mt-3 text-slate-600">Each office has its own secure workspace with dashboards, work queues and reports.</p>
            </div>
            <Link href="/login" className="inline-flex items-center gap-2 rounded-lg bg-ink px-5 py-3 text-sm font-semibold text-white hover:bg-ink/90">
              <LogIn className="size-4" /> Official sign in
            </Link>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {OFFICIAL.map((o, i) => (
              <Link key={o.title} href="/login" className="group rounded-2xl p-6 ring-1 ring-slate-200 transition hover:bg-canvas hover:ring-brand-300">
                <span className={cn("grid size-11 place-items-center rounded-xl", ACCENTS[(i + 1) % ACCENTS.length])}><o.icon className="size-5" /></span>
                <h3 className="mt-4 font-bold leading-snug">{o.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{o.body}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700">Sign in <ArrowRight className="size-4 transition group-hover:translate-x-1" /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 bg-canvas py-20 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <Eyebrow>Questions</Eyebrow>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Frequently asked</h2>
            <p className="mt-3 text-slate-600">Anything else? Contact the {EVENT.organiser} or your District Industries Centre.</p>
          </div>
          <div className="divide-y divide-slate-200 rounded-2xl bg-white ring-1 ring-slate-200">
            {FAQ.map((f) => (
              <details key={f.q} className="group px-6 py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <ChevronDown className="size-5 shrink-0 text-slate-400 transition group-open:rotate-180" />
                </summary>
                <p className="mt-3 leading-relaxed text-slate-600">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Closing call */}
      <section className="px-4 py-20 sm:px-6">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-ink px-8 py-14 text-white sm:px-14">
          <div className="tx-ribbon absolute inset-x-0 top-0 h-1.5" />
          <div className="absolute -right-16 -top-16 size-72 rounded-full bg-tx-green/30 blur-3xl" aria-hidden />
          <div className="absolute -bottom-24 left-1/3 size-72 rounded-full bg-tx-blue/20 blur-3xl" aria-hidden />
          <div className="relative grid gap-8 lg:grid-cols-[1.3fr_1fr] lg:items-center">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Be part of {EVENT.name}.</h2>
              <p className="mt-3 max-w-xl text-white/70">Registration takes a few minutes. Buyers and online seller applicants get their login by e-mail straight away.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
              <Link href="/signup" className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 font-semibold text-ink hover:bg-brand-50">
                <Globe2 className="size-4 text-tx-blue" /> I&apos;m a buyer
              </Link>
              <Link href="/seller-register" className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-6 py-3 font-semibold text-white hover:bg-brand-600">
                <Store className="size-4" /> I&apos;m a Kerala MSME
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm text-slate-500">{EVENT.name} {EVENT.programme} — organised by the {EVENT.organiser}, Government of Kerala, with {EVENT.partner}.</p>
          </div>
          <FooterCol title="Programme" links={[["#programme", "About"], ["#sectors", "Sectors"], ["#districts", "Districts"], ["#faq", "FAQ"]]} />
          <FooterCol title="Register" links={[["/signup", "International buyer"], ["/seller-register", "Kerala MSME seller"]]} />
          <FooterCol title="Sign in" links={[["/login", "Buyers & sellers"], ["/login", "Official portals"]]} />
        </div>
        <div className="border-t border-slate-100">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:px-6">
            <p>© {new Date().getFullYear()} {EVENT.organiser}, Government of Kerala.</p>
            <p className="inline-flex items-center gap-1.5"><Mail className="size-3.5" /> Login details are sent only by e-mail. Never share your password.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Eyebrow({ children, center, dark }: { children: React.ReactNode; center?: boolean; dark?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em]", center && "justify-center", dark ? "text-tx-green" : "text-brand-700")}>
      <span className="tx-ribbon h-1 w-8 rounded" /> {children}
    </div>
  );
}

function Journey({ id, tone, icon: Icon, label, title, steps, cta, note }: {
  id: string; tone: "blue" | "green"; icon: LucideIcon; label: string; title: string;
  steps: { icon: LucideIcon; title: string; body: string }[]; cta: { href: string; label: string }; note?: string;
}) {
  const c = tone === "blue"
    ? { bar: "bg-tx-blue", text: "text-tx-blue", soft: "bg-tx-blue/10", btn: "bg-tx-blue hover:bg-[#238ccb]" }
    : { bar: "bg-tx-green", text: "text-brand-600", soft: "bg-tx-green/10", btn: "bg-brand-600 hover:bg-brand-700" };
  return (
    <div id={id} className="relative scroll-mt-24 overflow-hidden rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200 sm:p-9">
      <span className={cn("absolute inset-x-0 top-0 h-1.5", c.bar)} />
      <div className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider", c.soft, c.text)}>
        <Icon className="size-4" /> {label}
      </div>
      <h3 className="mt-4 text-2xl font-extrabold tracking-tight">{title}</h3>
      <ol className="mt-7">
        {steps.map((s, i) => (
          <li key={s.title} className="relative flex gap-4 pb-6 last:pb-0">
            {i < steps.length - 1 && <span className="absolute left-5 top-11 h-[calc(100%-2.75rem)] w-px bg-slate-200" aria-hidden />}
            <span className={cn("relative grid size-10 shrink-0 place-items-center rounded-xl", c.soft, c.text)}><s.icon className="size-5" /></span>
            <div className="pt-0.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Step {i + 1}</div>
              <div className="font-bold">{s.title}</div>
              <p className="mt-0.5 text-sm text-slate-600">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Link href={cta.href} className={cn("inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold text-white", c.btn)}>{cta.label} <ArrowRight className="size-4" /></Link>
        {note && <p className="max-w-xs text-xs text-slate-500">{note}</p>}
      </div>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-wider text-slate-400">{title}</div>
      <ul className="mt-3 space-y-2 text-sm">
        {links.map(([h, l]) => <li key={l}><Link href={h} className="text-slate-600 hover:text-brand-700">{l}</Link></li>)}
      </ul>
    </div>
  );
}
