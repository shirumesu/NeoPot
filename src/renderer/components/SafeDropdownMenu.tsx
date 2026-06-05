import { DropdownMenu } from '@heroui/react'
import type { DropdownMenuProps } from '@heroui/react'
import type { ReactElement, ReactNode } from 'react'

export type SafeDropdownMenuProps<T extends object = object> = Omit<
  DropdownMenuProps<T>,
  'children'
> & {
  children?: ReactNode
}

const TypedDropdownMenu = DropdownMenu as <T extends object = object>(
  props: SafeDropdownMenuProps<T>,
) => ReactElement

export default function SafeDropdownMenu<T extends object = object>(
  props: SafeDropdownMenuProps<T>,
) {
  return <TypedDropdownMenu {...props} />
}
