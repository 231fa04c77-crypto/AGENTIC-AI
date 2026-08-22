import React from 'react';
import { motion } from 'framer-motion';

const BloodDropLoader = () => {
  return (
    <div className="flex flex-col items-center justify-center p-12">
      <div className="flex gap-4">
        {[0, 1, 2].map((index) => (
          <motion.div
            key={index}
            initial={{ scale: 0.8, opacity: 0.3 }}
            animate={{
              scale: [0.8, 1.2, 0.8],
              opacity: [0.3, 1, 0.3],
              fill: ['#fee2e2', '#ef4444', '#fee2e2']
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              delay: index * 0.4,
              ease: "easeInOut"
            }}
            className="relative"
          >
            <svg
              width="40"
              height="50"
              viewBox="0 0 30 42"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M15 0C15 0 0 17.1429 0 27C0 35.2843 6.71573 42 15 42C23.2843 42 30 35.2843 30 27C30 17.1429 15 0 15 0Z"
                className="fill-red-500"
              />
              <motion.path
                d="M15 5C15 5 5 18 5 27C5 33 9.5 37 15 37C20.5 37 25 33 25 27C25 18 15 5 15 5Z"
                fill="white"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.4, 0] }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: index * 0.4,
                }}
              />
            </svg>
          </motion.div>
        ))}
      </div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-6 text-red-600 font-bold tracking-widest uppercase text-xs"
      >
        Syncing Blood Inventory...
      </motion.p>
    </div>
  );
};

export default BloodDropLoader;
