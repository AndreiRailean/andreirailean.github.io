import { MoonStar, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

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
 * **Stateless, and that is the point.**
 *
 * It held a `useState` mirroring the theme before, which made it a second owner
 * of the `.dark` class alongside the document script — two owners, two moments,
 * and the class flipping between them on every load. Nothing here needs that
 * state: the sun and moon are swapped by the `dark:` variants in CSS, so the
 * class *is* the rendered state, and the only job left is to report a click.
 *
 * `window.theme` is optional because it is set by an inline script in `<head>`.
 * That script cannot fail to have run by the time this hydrates — a classic
 * script in the head, against a module after parse — but a missing lever should
 * leave a dead menu rather than a thrown render.
 */
export const DarkModeToggle = () => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon">
        <Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
        <MoonStar className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      {CHOICES.map(({ value, label }) => (
        <DropdownMenuItem key={value} onClick={() => window.theme?.set(value)}>
          {label}
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
)
