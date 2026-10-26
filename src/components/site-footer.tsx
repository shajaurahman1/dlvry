import { Link } from "@tanstack/react-router";

export function MadeByFooter() {
  return (
    <footer className="border-t border-border px-5 py-5 text-center text-xs text-muted-foreground">
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
        <a href="mailto:moveby.in@gmail.com" className="hover:text-primary">moveby.in@gmail.com</a>
        <a href="https://moveby.in" target="_blank" rel="noopener noreferrer" className="hover:text-primary">moveby.in</a>
        <Link to="/privacy" className="hover:text-primary">Privacy Policy</Link>
        <Link to="/terms" className="hover:text-primary">Terms &amp; Conditions</Link>
        <Link to="/delete-account" className="hover:text-primary">Delete account</Link>
      </div>
    </footer>
  );
}
