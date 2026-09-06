"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"
import { Check, ChevronDown, ChevronUp } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * A styled Select built on the Base UI primitive.
 *
 * A native `<select>` cannot be styled consistently: the popup and its
 * indicator are platform chrome, and iOS Safari ignores most of the closed
 * state's styling. This renders both parts itself so the control matches the
 * rest of the interface on every engine, and keeps the keyboard behaviour,
 * typeahead, and focus management that the primitive provides.
 *
 * `SelectField` is the shape almost every caller wants: a visible label, a
 * trigger, and a list of options. Reach for the exported parts directly only
 * when a screen needs something the field shape cannot express.
 */

function SelectTrigger({ className, children, ...props }: SelectPrimitive.Trigger.Props) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select"
      className={cn(
        // 44px on phones to meet the touch target floor, 40px from `sm` up.
        "flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 text-left text-sm transition-colors outline-none select-none sm:h-10",
        "hover:not-data-disabled:bg-muted/50",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        "data-popup-open:border-ring",
        "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        "dark:bg-input/30 dark:hover:not-data-disabled:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    >
      {children}
    </SelectPrimitive.Trigger>
  )
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      className={cn("truncate data-placeholder:text-muted-foreground", className)}
      {...props}
    />
  )
}

function SelectIcon({ className, ...props }: SelectPrimitive.Icon.Props) {
  return (
    <SelectPrimitive.Icon
      className={cn("shrink-0 text-muted-foreground", className)}
      {...props}
    >
      <ChevronDown className="size-4" aria-hidden="true" />
    </SelectPrimitive.Icon>
  )
}

/** A scroll affordance shown only when the list overflows its popup. */
function SelectScrollArrow({
  direction,
  ...props
}: { direction: "up" | "down" } & SelectPrimitive.ScrollUpArrow.Props) {
  const Part = direction === "up" ? SelectPrimitive.ScrollUpArrow : SelectPrimitive.ScrollDownArrow
  const Icon = direction === "up" ? ChevronUp : ChevronDown

  return (
    <Part
      className="z-1 flex h-5 w-full cursor-default items-center justify-center bg-popover text-muted-foreground"
      {...props}
    >
      <Icon className="size-3.5" aria-hidden="true" />
    </Part>
  )
}

function SelectPopup({ className, children, ...props }: SelectPrimitive.Popup.Props) {
  return (
    <SelectPrimitive.Popup
      data-slot="select-popup"
      className={cn(
        "surface-popup max-h-[var(--available-height)] min-w-[var(--anchor-width)] origin-[var(--transform-origin)] overflow-hidden rounded-xl border border-border/80 bg-popover p-1 text-popover-foreground outline-none",
        // The popup animates in and out; `tw-animate-css` is already a project
        // dependency but these states are simple enough to express directly.
        "transition-[transform,opacity] duration-(--motion-fast) ease-(--motion-ease-out)",
        "data-starting-style:scale-[0.98] data-starting-style:opacity-0",
        "data-ending-style:scale-[0.98] data-ending-style:opacity-0",
        // In `alignItemWithTrigger` mode the popup overlaps the trigger and
        // must not animate, or the selected row visibly drifts.
        "data-[side=none]:data-starting-style:scale-100 data-[side=none]:data-starting-style:opacity-100 data-[side=none]:data-starting-style:transition-none",
        "data-[side=none]:data-ending-style:transition-none",
        "motion-reduce:transition-none",
        className,
      )}
      {...props}
    >
      {children}
    </SelectPrimitive.Popup>
  )
}

function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "grid min-h-11 cursor-default grid-cols-[1rem_1fr] items-center gap-2 rounded-lg py-2 pr-3 pl-2 text-sm outline-none select-none",
        "data-highlighted:bg-accent data-highlighted:text-accent-foreground",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemIndicator className="col-start-1 text-primary">
        <Check className="size-4" aria-hidden="true" />
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText className="col-start-2">{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

export type SelectOption<Value extends string | number> = {
  value: Value
  label: React.ReactNode
  disabled?: boolean
}

/**
 * A labelled select. `value` and `onValueChange` are controlled, matching the
 * native element this replaces.
 *
 * The generic is constrained to string | number because these are form values
 * that round-trip through saved drafts and URL state.
 */
function SelectField<Value extends string | number>({
  label,
  options,
  value,
  onValueChange,
  id,
  disabled,
  placeholder,
  className,
  triggerClassName,
  labelClassName,
  description,
  /** Renders the label for assistive tech only, for a control whose purpose is clear from context. */
  hideLabel = false,
}: {
  label: string
  options: readonly SelectOption<Value>[]
  value: Value
  onValueChange: (value: Value) => void
  id?: string
  disabled?: boolean
  placeholder?: string
  className?: string
  triggerClassName?: string
  labelClassName?: string
  description?: React.ReactNode
  hideLabel?: boolean
}) {
  // `items` lets Select.Value render the selected option's label rather than
  // its raw value, which is what a native select shows.
  const items = React.useMemo(
    () => options.map((option) => ({ label: option.label, value: option.value })),
    [options],
  )

  return (
    <SelectPrimitive.Root
      items={items}
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        // The primitive types a clearable select as possibly null. This field
        // always has a selection, so ignore a null rather than widen callers.
        if (next !== null) onValueChange(next as Value)
      }}
    >
      <div className={cn("min-w-0", className)}>
        <SelectPrimitive.Label
          className={cn(
            "cursor-default text-sm font-semibold",
            hideLabel && "sr-only",
            labelClassName,
          )}
        >
          {label}
        </SelectPrimitive.Label>
        <SelectTrigger id={id} className={cn(!hideLabel && "mt-2", triggerClassName)}>
          <SelectValue placeholder={placeholder} />
          <SelectIcon />
        </SelectTrigger>
        {description ? (
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p>
        ) : null}
      </div>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner className="z-50 outline-none" sideOffset={4}>
          <SelectPopup>
            <SelectScrollArrow direction="up" />
            <SelectPrimitive.List className="max-h-[var(--available-height)] scroll-py-1 overflow-y-auto overscroll-contain">
              {options.map((option) => (
                <SelectItem key={String(option.value)} value={option.value} disabled={option.disabled}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectPrimitive.List>
            <SelectScrollArrow direction="down" />
          </SelectPopup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

export {
  SelectField,
  SelectTrigger,
  SelectValue,
  SelectIcon,
  SelectPopup,
  SelectItem,
  SelectPrimitive as Select,
}
