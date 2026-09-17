import * as React from "react"
import { MoonStar, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/**
 * What a person can choose. `"system"` is a real, persisted choice rather than a
 * placeholder for one — that distinction is the whole fix, and
 * `src/components/ThemeScript.astro` explains what went wrong when it was not.
 */
export type ThemeChoice = "light" | "dark" | "system"

declare global {
  interface Window {
    theme?: { choice: () => ThemeChoice; set: (choice: ThemeChoice) => void }
  }
}

const CHOICES: { value: ThemeChoice; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
]

/**
 * **A radio group rather than a checkmark hung on a plain item.**
 *
 * Three options, one of which is always in effect, is a radio group — so the
 * primitive gives `role="menuitemradio"` and `aria-checked` alongside the dot,
 * and a screen reader hears which scheme is on rather than three equal verbs.
 * Hand-placing a tick would have looked identical and said nothing.
 *
 * ## The state here is a mirror, not an owner
 *
 * This component held state once before and it was the bug: it set the `.dark`
 * class from its own initial value on mount and corrected itself a beat later,
 * so the class had two owners and a MutationObserver wrote the flicker to
 * `localStorage` as though it were a decision. See `ThemeScript.astro`.
 *
 * What is held now is only *which option to mark*, and nothing reads it but the
 * radio group. The document's scheme is still decided in exactly one place, and
 * a stale value here would show a wrong dot rather than a wrong page.
 *
 * ## Why it is read on open, and why it starts undefined
 *
 * The choice lives in `localStorage`, which the server cannot see — so rendering
 * a mark on the first pass would be a hydration mismatch. `undefined` marks
 * nothing, and the menu needs JavaScript to open at all, so no one can see the
 * unmarked state.
 *
 * Re-read on every open because this is not the only writer: another tab, or a
 * `localStorage` the browser declined to persist, would otherwise leave the dot
 * asserting something that was true once. Reading it when it is about to be
 * looked at costs nothing and cannot go stale.
 */
export const DarkModeToggle = () => {
  const [choice, setChoice] = React.useState<ThemeChoice | undefined>(undefined)

  const sync = () => setChoice(window.theme?.choice())

  React.useEffect(sync, [])

  return (
    <DropdownMenu onOpenChange={(open) => open && sync()}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <MoonStar className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={choice}
          onValueChange={(next) => {
            // Narrowed rather than cast: the primitive hands back a bare string,
            // and the three values it can be are the three rendered below.
            const picked = CHOICES.find(({ value }) => value === next)
            if (!picked) return
            window.theme?.set(picked.value)
            setChoice(picked.value)
          }}
        >
          {CHOICES.map(({ value, label }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
