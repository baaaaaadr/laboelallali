/** Doublure de `next/link` : un `<a>`, hors du routeur de l'application. */
import React from 'react';

export default function Link({
  href,
  children,
  ...rest
}: { href: string; children?: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a href={href} {...rest}>{children}</a>;
}
