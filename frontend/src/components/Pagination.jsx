import React from 'react'

const Pagination = ({ currentPage, totalPages, onPageChange, itemsPerPage, totalItems }) => {
  // Calculate which page numbers to show
  const getPageNumbers = () => {
    const pages = []
    const maxVisible = 5
    
    if (totalPages <= maxVisible) {
      // Show all pages if total pages are less than max visible
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Show pages with ellipsis logic
      if (currentPage <= 3) {
        // Show first few pages
        for (let i = 1; i <= 4; i++) {
          pages.push(i)
        }
        pages.push('ellipsis')
        pages.push(totalPages)
      } else if (currentPage >= totalPages - 2) {
        // Show last few pages
        pages.push(1)
        pages.push('ellipsis')
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i)
        }
      } else {
        // Show pages around current page
        pages.push(1)
        pages.push('ellipsis')
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i)
        }
        pages.push('ellipsis')
        pages.push(totalPages)
      }
    }
    
    return pages
  }

  const pageNumbers = getPageNumbers()
  
  // Calculate range of items being shown
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalItems)

  if (totalPages <= 1) {
    return null // Don't show pagination if there's only one page or no items
  }

  return (
    <div className="flex flex-col items-center gap-4 mt-8">
      {/* Results info */}
      <div className="text-sm text-gray-600 font-medium">
        Showing {startItem}-{endItem} of {totalItems} results
      </div>

      {/* Pagination controls */}
      <div className="flex items-center gap-2">
        {/* Previous button */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 ${
            currentPage === 1
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-white/70 backdrop-blur-md text-gray-700 hover:bg-white/90 hover:shadow-md border border-white/50'
          }`}
        >
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Previous
          </div>
        </button>

        {/* Page numbers */}
        <div className="flex items-center gap-1">
          {pageNumbers.map((page, index) => {
            if (page === 'ellipsis') {
              return (
                <span key={`ellipsis-${index}`} className="px-3 py-2 text-gray-400">
                  ...
                </span>
              )
            }

            return (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 ${
                  currentPage === page
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 hover:bg-blue-700'
                    : 'bg-white/70 backdrop-blur-md text-gray-700 hover:bg-white/90 hover:shadow-md border border-white/50'
                }`}
              >
                {page}
              </button>
            )
          })}
        </div>

        {/* Next button */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 ${
            currentPage === totalPages
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-white/70 backdrop-blur-md text-gray-700 hover:bg-white/90 hover:shadow-md border border-white/50'
          }`}
        >
          <div className="flex items-center gap-1">
            Next
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>
      </div>
    </div>
  )
}

export default Pagination

