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

- Session/salle/rôle are simulated in `src/lib/mock-session.tsx` (localStorage) until the user's external database is linked; keep its `useOrg()` API so pages don't change when it is swapped for the real client.
- Signed-in pages live under the pathless `_espace` layout, which handles login/onboarding redirects and blocks admin-only paths listed in `src/lib/nav.ts`.
- Demo data, views and rpc equivalents live in `src/lib/mock-db.ts` (localStorage, seeded per salle); pages call only its exports so each can later map 1:1 to supabase views/rpc.
