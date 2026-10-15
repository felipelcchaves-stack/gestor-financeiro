import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

/* Botão do design system "Vimeo" (skill vimeo-design): padrão PRETO com texto branco (no escuro, invertido),
   secundário cinza, fantasma, perigo. Raio 12px, 44px de altura (48px no grande), rótulo em texto normal (sem caixa
   alta). Sombra bem sutil só no preto. Tamanhos pequenos crescem para 44px em telas de toque. */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-xl border border-transparent bg-clip-padding max-w-full text-center text-[0.9375rem] leading-tight font-semibold whitespace-normal sm:whitespace-nowrap transition-[box-shadow,background-color,opacity] duration-150 outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-60 disabled:shadow-none aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(0,0,0,0.18)] hover:opacity-85",
        outline:
          "border-border-strong bg-card text-foreground hover:bg-secondary aria-expanded:bg-secondary",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-accent aria-expanded:bg-accent",
        ghost:
          "bg-transparent text-foreground hover:bg-accent aria-expanded:bg-accent",
        destructive:
          "bg-destructive text-destructive-foreground hover:opacity-90 focus-visible:outline-destructive",
        link: "min-h-0 rounded-none px-0 text-brand-text underline underline-offset-4 hover:no-underline",
      },
      size: {
        default:
          "min-h-11 gap-2 px-5 py-2 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        xs: "min-h-8 gap-1 rounded-lg px-2.5 text-xs [@media(pointer:coarse)]:min-h-11 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "min-h-9 gap-1.5 px-3.5 py-1.5 text-[0.8125rem] [@media(pointer:coarse)]:min-h-11 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "min-h-12 gap-2 px-6 py-2.5 text-base has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
        icon: "size-11 p-0",
        "icon-xs":
          "size-8 rounded-lg p-0 [@media(pointer:coarse)]:size-11 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-9 p-0 [@media(pointer:coarse)]:size-11",
        "icon-lg": "size-12 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
