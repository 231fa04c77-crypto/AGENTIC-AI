import * as React from "react"
import { ChevronRight, MoreHorizontal } from "lucide-react"
import { Link } from "react-router-dom"

const Breadcrumb = React.forwardRef(({ className, ...props }, ref) => (
  <nav ref={ref} aria-label="breadcrumb" {...props} />
))
Breadcrumb.displayName = "Breadcrumb"

const BreadcrumbList = React.forwardRef(({ className, ...props }, ref) => (
  <ol
    ref={ref}
    className={`flex flex-wrap items-center gap-1.5 break-words text-base sm:text-lg font-semibold text-gray-700 sm:gap-2.5 w-full justify-start ${className || ''}`}
    {...props}
  />
))
BreadcrumbList.displayName = "BreadcrumbList"

const BreadcrumbItem = React.forwardRef(({ className, ...props }, ref) => (
  <li
    ref={ref}
    className={`inline-flex items-center gap-1 sm:gap-1.5 ${className || ''}`}
    {...props}
  />
))
BreadcrumbItem.displayName = "BreadcrumbItem"

const BreadcrumbLink = React.forwardRef(({ asChild, className, ...props }, ref) => {
  if (asChild) {
    // When asChild is true, return Fragment without className (Fragment doesn't accept className)
    return <React.Fragment {...props} />
  }
  
  return (
    <Link
      ref={ref}
      className={`transition-colors hover:text-gray-900 font-semibold truncate max-w-[150px] sm:max-w-none ${className || ''}`}
      {...props}
    />
  )
})
BreadcrumbLink.displayName = "BreadcrumbLink"

const BreadcrumbPage = React.forwardRef(({ className, ...props }, ref) => (
  <span
    ref={ref}
    role="link"
    aria-disabled="true"
    aria-current="page"
    className={`font-bold text-gray-900 truncate max-w-[200px] sm:max-w-none ${className || ''}`}
    {...props}
  />
))
BreadcrumbPage.displayName = "BreadcrumbPage"

const BreadcrumbSeparator = ({ children, className, ...props }) => (
  <li
    role="presentation"
    aria-hidden="true"
    className={`text-gray-500 mx-0.5 sm:mx-1.5 font-semibold ${className || ''}`}
    {...props}
  >
    {children ?? <span>/</span>}
  </li>
)
BreadcrumbSeparator.displayName = "BreadcrumbSeparator"

const BreadcrumbEllipsis = ({ className, ...props }) => (
  <span
    role="presentation"
    aria-hidden="true"
    className={`flex h-9 w-9 items-center justify-center ${className || ''}`}
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">More</span>
  </span>
)
BreadcrumbEllipsis.displayName = "BreadcrumbEllipsis"

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
}

