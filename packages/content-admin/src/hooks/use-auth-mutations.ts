// Auth mutations for the admin. `useSignIn` posts to the magic-link sign-in
// endpoint; the login screen reads `isPending` / `isSuccess` / `error` off it.

import { useMutation } from "@tanstack/react-query";
import { useAdmin } from "../context";

export function useSignIn() {
  const { admin } = useAdmin();
  return useMutation({
    mutationFn: async (email: string) => {
      const res = await fetch(`${admin.apiPath}/auth/sign-in/magic-link`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, callbackURL: admin.basePath || "/" }),
      });
      if (!res.ok) throw new Error(`Could not send the sign-in link (${res.status}).`);
    },
  });
}
