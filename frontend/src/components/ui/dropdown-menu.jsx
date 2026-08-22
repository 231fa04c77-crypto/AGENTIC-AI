import * as React from "react"
import { ChevronDown } from "lucide-react"

const DropdownMenuContext = React.createContext(null)

const DropdownMenu = ({ children }) => {
  const [open, setOpen] = React.useState(false)

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block text-left">
        {React.Children.map(children, child => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child, { open, setOpen })
          }
          return child
        })}
      </div>
    </DropdownMenuContext.Provider>
  )
}

const DropdownMenuTrigger = React.forwardRef(({ 
  className, 
  children, 
  open, 
  setOpen,
  asChild,
  ...props 
}, ref) => {
  const context = React.useContext(DropdownMenuContext)
  const isOpen = open ?? context?.open ?? false
  const setIsOpen = setOpen ?? context?.setOpen

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      ...props,
      className: `${children.props.className || ''} ${className || ''}`,
      onClick: (e) => {
        children.props.onClick?.(e);
        setIsOpen(!isOpen);
      }
    })
  }

  return (
    <button
      ref={ref}
      type="button"
      className={`inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ${className || ''}`}
      onClick={() => setIsOpen(!isOpen)}
      {...props}
    >
      {children}
    </button>
  )
})
DropdownMenuTrigger.displayName = "DropdownMenuTrigger"

const DropdownMenuContent = React.forwardRef(({ 
  align = "start", 
  className, 
  open,
  setOpen,
  ...props 
}, ref) => {
  const context = React.useContext(DropdownMenuContext)
  const isOpen = open ?? context?.open ?? false
  const setIsOpen = setOpen ?? context?.setOpen
  const contentRef = React.useRef(null)
  const combinedRef = ref || contentRef

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (combinedRef?.current && !combinedRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen, setIsOpen, combinedRef])

  if (!isOpen) return null

  const alignClasses = {
    start: "left-0",
    end: "right-0",
    center: "left-1/2 -translate-x-1/2"
  }

  return (
    <div
      ref={combinedRef}
      className={`absolute z-50 min-w-[8rem] overflow-hidden rounded-md border border-gray-200 bg-white p-1 text-gray-900 shadow-md ${alignClasses[align]} ${className || ''}`}
      {...props}
    />
  )
})
DropdownMenuContent.displayName = "DropdownMenuContent"

const DropdownMenuItem = React.forwardRef(({ 
  className, 
  children,
  onClick,
  ...props 
}, ref) => {
  const context = React.useContext(DropdownMenuContext)
  const setIsOpen = context?.setOpen

  const handleClick = (e) => {
    onClick?.(e)
    setIsOpen?.(false)
  }

  return (
    <div
      ref={ref}
      role="menuitem"
      className={`relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-gray-100 focus:bg-gray-100 focus:text-gray-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ${className || ''}`}
      onClick={handleClick}
      {...props}
    >
      {children}
    </div>
  )
})
DropdownMenuItem.displayName = "DropdownMenuItem"

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
}

