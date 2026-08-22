import React, { useState, useEffect } from 'react';

const ScrollToTop = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      const mainContent = document.querySelector('.main-content-area');
      if (mainContent) {
        // Show button when user scrolls down more than 300px
        setIsVisible(mainContent.scrollTop > 300);
      }
    };

    const mainContent = document.querySelector('.main-content-area');
    if (mainContent) {
      mainContent.addEventListener('scroll', toggleVisibility);
    }

    return () => {
      if (mainContent) {
        mainContent.removeEventListener('scroll', toggleVisibility);
      }
    };
  }, []);

  const scrollToTop = () => {
    const mainContent = document.querySelector('.main-content-area');
    if (mainContent) {
      mainContent.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <button
      onClick={scrollToTop}
      className="scroll-to-top-btn fixed bottom-4 left-4 z-[9998] w-10 h-10 bg-white border border-gray-300 rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-all duration-300 hover:shadow-xl active:scale-95"
      aria-label="Scroll to top"
    >
      <svg
        className="w-5 h-5 text-gray-700"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 10l7-7m0 0l7 7m-7-7v18"
        />
      </svg>
    </button>
  );
};

export default ScrollToTop;

