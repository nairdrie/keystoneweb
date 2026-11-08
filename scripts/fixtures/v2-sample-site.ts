/**
 * A small but realistic agent-built site, used by the v2 engine tests and as a
 * worked example in the agent guide.
 */
import type { SiteBundle } from '../../lib/v2/types';
import { compileSection } from '../../lib/v2/compile';

const header = `
<header class="bar">
  <a href="/" class="brand"><img data-ks="@site.logo" src="https://example.com/logo.png" alt="Logo"><span data-ks="@site.name">Northline Roofing</span></a>
  <nav><ul data-ks-nav><li><a href="/">Home</a></li></ul></nav>
  <a class="call" data-ks="@business.phone" href="tel:">(905) 555-0100</a>
</header>`;

const hero = `
<section class="hero" data-ks="bg" data-ks-type="bg" style="background-image:url('https://example.com/roof.jpg')">
  <p class="eyebrow" data-ks="eyebrow">Oakville · Since 1994</p>
  <h1 data-ks="title" data-ks-max="70">Roofs done <em class="accent">right</em>, the first time.</h1>
  <div data-ks="intro" data-ks-type="richtext"><p>Family-owned crews, written warranties, and a site that's spotless when we leave.</p></div>
  <div class="ctas">
    <a class="btn" data-ks="cta" href="/contact">Get a free quote</a>
    <a class="btn ghost" data-ks="cta2" href="/work">See our work</a>
  </div>
  <ul class="badges" data-ks-list="badges" data-ks-max-items="4">
    <li data-ks-item><span data-ks="label">Licensed &amp; insured</span></li>
    <li data-ks-item><span data-ks="label">25-year warranty</span></li>
  </ul>
  <svg class="swoosh" viewBox="0 0 10 10"><text x="0" y="5">decor</text></svg>
</section>
<style>
  :root { min-height: 80vh; }
  .hero { color: white; padding: 6rem 2rem; background-size: cover; }
  .hero h1 { font: 800 clamp(2.5rem, 7vw, 6rem)/.95 var(--font-display); }
  @media (max-width: 600px) { .ctas { flex-direction: column; } }
  @keyframes rise { from { opacity: 0 } to { opacity: 1 } }
</style>
<script type="module">
export default (root, ks) => { root.querySelector('h1')?.classList.add('in'); };
</script>`;

const services = `
<section class="services">
  <h2 data-ks="heading">What we do</h2>
  <div class="grid" data-ks-list="items">
    <article data-ks-item>
      <img data-ks="photo" data-ks-aspect="4/3" src="https://example.com/a.jpg" alt="Shingle roof">
      <h3 data-ks="name">Roof replacement</h3>
      <p data-ks="blurb">Tear-off to final inspection in as little as two days.</p>
      <a data-ks="link" href="/contact">Book an inspection</a>
    </article>
    <article data-ks-item>
      <img data-ks="photo" src="https://example.com/b.jpg" alt="Repair">
      <h3 data-ks="name">Repairs</h3>
      <p data-ks="blurb">Leaks found and fixed fast.</p>
      <a data-ks="link" href="/contact">Book a repair</a>
    </article>
  </div>
</section>`;

const contact = `
<section class="contact">
  <h2 data-ks="heading">Get a free quote</h2>
  <form data-ks-form="contact">
    <label><span data-ks="nameLabel">Your name</span><input name="name" required></label>
    <label><span data-ks="emailLabel">Email</span><input name="email" type="email" required></label>
    <textarea name="message">Tell us about your roof</textarea>
    <button data-ks="submit" type="submit">Send</button>
    <p data-ks-form-success hidden data-ks="thanks">Thanks! We'll call you within one business day.</p>
  </form>
  <p><span data-ks="callLabel">Or call</span> <a data-ks="@business.phone" href="tel:">(905) 555-0100</a></p>
</section>`;

const footer = `
<footer><p data-ks="blurb">Northline Roofing</p><p data-ks-static>© <span data-ks="@site.year">2026</span></p></footer>`;

function section(key: string, name: string, html: string) {
  return { key, name, html, css: '', js: '', schema: compileSection(html) };
}

export function sampleBundle(): SiteBundle {
  const sections = {
    header: section('header', 'Header', header),
    hero: section('hero', 'Hero', hero),
    services: section('services', 'Services', services),
    contact: section('contact', 'Contact', contact),
    footer: section('footer', 'Footer', footer),
  };
  return {
    site: {
      id: '00000000-0000-0000-0000-000000000001',
      title: 'Northline Roofing',
      logo: 'https://cdn.example.com/northline-logo.png',
      favicon: null,
      contactEmail: 'hello@northline.ca',
      businessProfile: { legalName: 'Northline Roofing Ltd.', telephone: '+1 905-555-0199', streetAddress: '1 Main St', addressLocality: 'Oakville', addressRegion: 'ON', postalCode: 'L6J 1A1', openingHours: ['Mo-Fr 08:00-17:00'] },
      domain: 'northline.kswd.ca',
    },
    theme: {
      tokens: [
        { name: 'color-brand', value: '#c2410c', type: 'color', label: 'Brand', editable: true },
        { name: 'font-display', value: "'Fraunces', serif", type: 'font', label: 'Headings', editable: true },
      ],
      owner_overrides: {},
      fonts: [],
      global_css: 'body{margin:0;font-family:system-ui}',
      global_js: '',
      header_section: 'header',
      footer_section: 'footer',
    },
    sections,
    pages: [
      { id: 'p-home', slug: 'home', title: 'Home', display_name: 'Home', is_visible_in_nav: true, nav_order: 0, seo: { description: 'Roofing in Oakville' }, instances: [{ id: 'i-hero', section: 'hero' }, { id: 'i-services', section: 'services' }, { id: 'i-contact', section: 'contact' }] },
      { id: 'p-contact', slug: 'contact', title: 'Contact', display_name: 'Contact us', is_visible_in_nav: true, nav_order: 2, seo: {}, instances: [{ id: 'i-contact2', section: 'contact' }] },
      { id: 'p-work', slug: 'work', title: 'Our work', display_name: 'Our work', is_visible_in_nav: true, nav_order: 1, seo: {}, instances: [] },
    ],
    content: {},
    ownerEdited: [],
  };
}

export const SAMPLE_SECTIONS = { header, hero, services, contact, footer };
