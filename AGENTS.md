<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

- Never add `.env` to .gitignore — hosted builds read the publishable VITE*SUPABASE*\* values from it; without it the app crashes with "Missing Supabase environment variable(s)".
- Keep the existing Android package ID and callback scheme during display-name rebrands so installed-app upgrades and recovery links remain compatible.
- Use one shared logo component and a brief root-level splash overlay so branding is consistent without delaying authentication or navigation.
- Use Embla's vertical drag-free carousel and auto-scroll plugin for the story wheel so touch gestures, looping, and user-controlled playback stay smooth.
