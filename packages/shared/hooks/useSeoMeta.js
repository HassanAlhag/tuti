import { useEffect } from "react";

const SITE_NAME = "Tuti";
const DEFAULT_OG_IMAGE = "/og-image.png";

function setMetaTag(selector, content, attr = "name") {
  if (content == null) return;
  let el = document.querySelector(`meta[${attr}="${selector}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, selector);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href) {
  let el = document.querySelector("link[rel='canonical']");
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function injectJsonLd(id, data) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("script");
    el.setAttribute("type", "application/ld+json");
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

function removeJsonLd(id) {
  document.getElementById(id)?.remove();
}

export function useSeoMeta({ title, description, ogImage, canonical, jsonLd } = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} — ${SITE_NAME}` : SITE_NAME;
    const prevTitle = document.title;
    document.title = fullTitle;

    const desc = description || "Luxury perfumes, cakes, and gift sets in one marketplace. Cash on delivery available.";
    setMetaTag("description", desc);
    setMetaTag("og:title", fullTitle, "property");
    setMetaTag("og:description", desc, "property");
    setMetaTag("og:image", ogImage || DEFAULT_OG_IMAGE, "property");

    const href = canonical || window.location.origin + window.location.pathname;
    setCanonical(href);
    setMetaTag("og:url", href, "property");

    const LD_ID = "tuti-page-jsonld";
    if (jsonLd) {
      injectJsonLd(LD_ID, jsonLd);
    } else {
      removeJsonLd(LD_ID);
    }

    return () => {
      document.title = prevTitle;
      removeJsonLd(LD_ID);
    };
  }, [title, description, ogImage, canonical, jsonLd]);
}
