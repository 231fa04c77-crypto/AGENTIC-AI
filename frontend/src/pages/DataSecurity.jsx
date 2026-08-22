import React, { useState } from 'react'
import BackButton from '../components/BackButton'
import BackArrow from '../components/BackArrow'

const DataSecurity = () => {
  const [openFAQ, setOpenFAQ] = useState(0); // First FAQ is open by default

  const toggleFAQ = (index) => {
    setOpenFAQ(openFAQ === index ? null : index);
  };

  const faqs = [
    {
      question: "What is MedClues's view on data security and Privacy?",
      answer: (
        <>
          At MedClues we take data security and privacy extremely seriously. It is one of the foundational pillars of our company and is implemented at the core of every product.
          <br /><br />
          We believe that healthcare data is the most sensitive information about you and must receive appropriate protection. MedClues collects or uses any personal or sensitive personal information belonging to you only after receiving appropriate and clear consent from you. Further, we understand that people change their minds, so no consent is permanent and our systems are built with the flexibility so that any consent given can later be revoked.
          <br /><br />
          This is why all our products have features where patients and providers are in control and can decide what they want to share and what they prefer to keep private.
        </>
      )
    },
    {
      question: "What data does MedClues have?",
      answer: (
        <>
          At the outset, our data is stored with 256 bit encryption on HIPAA compliant servers. Further, we are an ISO27001:2013 certified company. This certification is one of the most recognized and stringent information security certification that validates a company's efforts on protecting data and all kinds of information assets.
          <br /><br />
          We have two distinct data sets. First is when health care providers use our software to store information regarding the patients they are treating. This can include information about the patient, their diagnosis, treatment plan, any clinical notes, communication and other details. All of this is stored on behalf of the provider and MedClues cannot access this. It is stored privately and securely for every provider who uses our software.
          <br /><br />
          The other data set is when patients directly visit MedClues and use MedClues to store their health history or undertake a healthcare transaction, such as booking an appointment, online consultation and more. We store all this data on behalf of the patient and this too is stored with 256 bit encryption and HIPAA compliant servers.
        </>
      )
    },
    {
      question: "Is my data really safe with MedClues?",
      answer: (
        <>
          Absolutely. MedClues is amongst the safest places for you to store your healthcare information and that of your patients.
          <br /><br />
          We have a variety of measures that protect your data, some of which are:
          <br /><br />
          1. <strong>HIPAA Compliant servers:</strong> All data is stored in HIPAA compliant servers
          <br />
          2. <strong>Encryption:</strong> All data is encrypted with 256 bit encryption during transit and at rest.
          <br />
          3. <strong>Two Factor:</strong> We have implemented Two-factor authentication to protect against foul-play.
          <br />
          4. <strong>Access Zones:</strong> We have implemented access zones that prohibit access to information from locations not specified by the user.
          <br />
          5. <strong>Role Based Profiles:</strong> A doctor/clinic owner can set up different profiles for their staff with different levels of information access.
          <br />
          6. <strong>Data Backup:</strong> We take multiple backups of your data and it is kept in geographically distributed locations to make sure you never have any data loss.
          <br />
          7. <strong>No Virus:</strong> Since all your data is stored in cloud, it protects you from any local virus that your computer might have.
        </>
      )
    },
    {
      question: "Have you ever faced a data breach?",
      answer: "No we have not. We will continue to work very hard to make sure that data stored with MedClues remains secure."
    },
    {
      question: "Is MedClues compliant with the data security and privacy laws in India?",
      answer: "Of Course, MedClues complies with all applicable laws in every country it operates in."
    },
    {
      question: "What if I find a security vulnerability in any of your applications?",
      answer: (
        <>
          In the unlikely event that you discover a vulnerability, we do have a responsible security disclosure program that prescribes next course of action and we would love to hear from you and fix it at the earliest. Please report them to us at <a href="mailto:security@MedClues.com" className="text-cyan-600 hover:underline">security@MedClues.com</a>.
        </>
      )
    }
  ];

  return (
    <div className="min-h-screen">
      <div className="page-container fade-in py-4 md:py-8 lg:py-12 px-4 sm:px-6 lg:px-8">
        {/* Back Arrow Button */}
        <div className="mb-4 md:mb-6 flex items-center gap-4">
          <BackArrow />
          <BackButton to="/" label="Back to Home" />
        </div>

        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8 md:mb-12 lg:mb-16">
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black text-gray-800 mb-3 md:mb-4 tracking-tight px-2" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
              Data <span className="text-cyan-600">&amp;</span> Security
            </h1>
            <p className="text-sm sm:text-base md:text-lg text-gray-700 font-semibold max-w-3xl mx-auto mt-4 md:mt-6 px-2">
              Trust: the foundation on which MedClues is built
            </p>
          </div>

        {/* Hero Section with Image - Matching Practo Layout */}
        <div className="mb-8 md:mb-12 lg:mb-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 lg:gap-16 items-center">
            {/* Content Section - Left Side */}
            <div className="order-2 lg:order-1">
              <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black text-gray-800 mb-6 md:mb-8 leading-tight tracking-tight px-2" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                Your data has only one owner.
                <br />
                <span className="text-cyan-600 font-black">YOU!</span>
              </h2>
              <div className="space-y-4 md:space-y-6 text-gray-700 mb-8 md:mb-10">
                <div className="flex items-start gap-3 md:gap-4">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-orange-500 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-gray-800 font-semibold text-sm sm:text-base md:text-lg leading-relaxed">MedClues does not have access to your data</p>
                </div>
                <div className="flex items-start gap-3 md:gap-4">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-orange-500 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-gray-800 font-semibold text-sm sm:text-base md:text-lg leading-relaxed">MedClues does not sell or share your data with any third party</p>
                </div>
                <div className="flex items-start gap-3 md:gap-4">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-orange-500 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-gray-800 font-semibold text-sm sm:text-base md:text-lg leading-relaxed">MedClues follows stringent policies so that data isn't compromised at any step</p>
                </div>
              </div>
              
              {/* Security Features Icons */}
              <div className="grid grid-cols-3 gap-2 sm:gap-4 md:gap-8 mt-8 md:mt-12">
                <div className="text-center">
                  <div className="relative inline-block mb-2 md:mb-4">
                    <svg className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-18 lg:h-18 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 bg-cyan-600 rounded-full flex items-center justify-center shadow-md">
                      <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-4 md:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm md:text-base font-bold text-gray-800 leading-tight">256-bit<br />encryption</p>
                </div>
                
                <div className="text-center">
                  <div className="relative inline-block mb-2 md:mb-4">
                    <svg className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-18 lg:h-18 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 bg-cyan-600 rounded-full flex items-center justify-center shadow-md">
                      <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-4 md:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm md:text-base font-bold text-gray-800 leading-tight">ISO 27001<br />certified</p>
                </div>
                
                <div className="text-center">
                  <div className="relative inline-block mb-2 md:mb-4">
                    <svg className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-18 lg:h-18 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 bg-cyan-600 rounded-full flex items-center justify-center shadow-md">
                      <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-4 md:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm md:text-base font-bold text-gray-800 leading-tight">HIPAA<br />compliant<br />data centers</p>
                </div>
              </div>
            </div>
            
            {/* Image Section - Right Side */}
            <div className="order-1 lg:order-2 flex justify-center lg:justify-start">
              <div className="relative w-full max-w-lg px-4 sm:px-0">
                <img 
                  src="/security.png" 
                  alt="Data Security - Security guards protecting data" 
                  className="w-full h-auto object-contain"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ISO 27001 Section */}
        <div className="mb-8 md:mb-12 lg:mb-16">
          <div className="flex flex-col md:flex-row items-start gap-4 md:gap-6 lg:gap-8 mb-6 md:mb-8">
            {/* BSI Logo */}
            <div className="flex-shrink-0 mx-auto md:mx-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 bg-gray-100 rounded-full flex items-center justify-center border-2 border-gray-300">
                <div className="text-center px-2">
                  <div className="text-xs sm:text-sm font-bold text-gray-800">BSI</div>
                  <div className="text-[7px] sm:text-[8px] md:text-[10px] text-gray-600 mt-0.5 sm:mt-1">ISO/IEC 27001</div>
                  <div className="text-[7px] sm:text-[8px] md:text-[10px] text-gray-600">Information Security</div>
                </div>
              </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-gray-900 mb-3 md:mb-4 tracking-tight px-2" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                We are ISO 27001 certified
              </h2>
              <p className="text-sm sm:text-base md:text-lg text-gray-700 mb-4 md:mb-6 leading-relaxed px-2">
                <span className="text-orange-600 font-bold">BSI</span> — a global authority in information security standards — has <span className="text-orange-600 font-bold">certified</span> that MedClues ensures confidentiality, availability, and integrity of its information assets
              </p>
              
              {/* Bullet Points with Orange Checkmarks */}
              <div className="space-y-3 md:space-y-4">
                <div className="flex items-start gap-2 md:gap-3">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-gray-800 text-xs sm:text-sm md:text-base leading-relaxed">Secure organizational practices ensured by awareness and stringent access controls</p>
                </div>
                <div className="flex items-start gap-2 md:gap-3">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-gray-800 text-xs sm:text-sm md:text-base leading-relaxed">Secure processes through strong administrative controls and monitoring</p>
                </div>
                <div className="flex items-start gap-2 md:gap-3">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-gray-800 text-xs sm:text-sm md:text-base leading-relaxed">Secure systems with strong technical measures, and frequent vulnerability assessments and penetration testing</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Data Security for Patients and Doctors - Side by Side */}
        <div className="mb-8 md:mb-12 lg:mb-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 lg:gap-8">
            {/* Data Security for Patients */}
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 md:p-8 hover:shadow-xl transition-all">
              <h2 className="text-lg sm:text-xl md:text-2xl font-black text-gray-900 mb-4 md:mb-6 pb-2 md:pb-3 border-b-4 border-blue-600 tracking-tight" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                Data security for patients
              </h2>
              <div className="space-y-3 md:space-y-4">
                <div className="flex items-start gap-2 md:gap-3">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-600 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-gray-800 text-xs sm:text-sm md:text-base leading-relaxed">Your data is for your eyes only</p>
                </div>
                <div className="flex items-start gap-2 md:gap-3">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-600 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-gray-800 text-xs sm:text-sm md:text-base leading-relaxed">No one at MedClues can view your data</p>
                </div>
                <div className="flex items-start gap-2 md:gap-3">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-600 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-gray-800 text-xs sm:text-sm md:text-base leading-relaxed">We do not send you messages without your permission</p>
                </div>
                <div className="flex items-start gap-2 md:gap-3">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-600 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-gray-800 text-xs sm:text-sm md:text-base leading-relaxed">We send promotional messages with an option to opt out any time</p>
                </div>
                <div className="flex items-start gap-2 md:gap-3">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-600 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-gray-800 text-xs sm:text-sm md:text-base leading-relaxed">We do not share data with any third party</p>
                </div>
              </div>
            </div>

            {/* Data Security for Doctors */}
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 md:p-8 hover:shadow-xl transition-all">
              <h2 className="text-lg sm:text-xl md:text-2xl font-black text-gray-900 mb-4 md:mb-6 pb-2 md:pb-3 border-b-4 border-orange-600 tracking-tight" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                Data security for doctors
              </h2>
              <div className="space-y-3 md:space-y-4">
                <div className="flex items-start gap-2 md:gap-3">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-600 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-gray-800 text-xs sm:text-sm md:text-base leading-relaxed">We do not have access to read or view your practice data</p>
                </div>
                <div className="flex items-start gap-2 md:gap-3">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-600 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-gray-800 text-xs sm:text-sm md:text-base leading-relaxed">We do not share data with any third party</p>
                </div>
                <div className="flex items-start gap-2 md:gap-3">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-600 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-gray-800 text-xs sm:text-sm md:text-base leading-relaxed">Doctors are in full control to decide what communication has to be sent to their patients</p>
                </div>
                <div className="flex items-start gap-2 md:gap-3">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-600 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-gray-800 text-xs sm:text-sm md:text-base leading-relaxed">We follow stringent data policies to ensure users' privacy and security</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Secure Platform Section */}
        <div className="mb-8 md:mb-12 lg:mb-16">
          <div className="text-center mb-6 md:mb-8">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-gray-900 mb-3 md:mb-4 tracking-tight px-2" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
              Secure platform for healthcare providers
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-gray-700 font-semibold max-w-3xl mx-auto mb-6 md:mb-8 px-2">
              Each MedClues product is designed to protect data security and privacy
            </p>
            
            {/* Illustration - Doctor with Folder */}
            <div className="flex justify-center mb-6 md:mb-8">
              <div className="relative w-40 h-40 sm:w-48 sm:h-48 md:w-64 md:h-64">
                <img 
                  src="/providers.png" 
                  alt="Secure platform for healthcare providers" 
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 lg:gap-8">
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 md:p-8 hover:shadow-xl transition-all">
              <div className="flex flex-col sm:flex-row items-start gap-3 md:gap-4 mb-3 md:mb-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 flex-shrink-0 mx-auto sm:mx-0">
                  <img 
                    src="/promo.png" 
                    alt="No promotions to walk-in patients" 
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="font-bold text-gray-900 mb-2 md:mb-3 text-sm sm:text-base md:text-lg">We never send promotions to your walk-in patients</h3>
                  <p className="text-gray-700 text-xs sm:text-sm md:text-base leading-relaxed">
                    As per our privacy policy, we never reach out to your walk-in patients or send any promotional communication to them. The only way for any patient to receive any promotion from us is if they visit MedClues independently and give us permission to contact them.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 md:p-8 hover:shadow-xl transition-all">
              <div className="flex flex-col sm:flex-row items-start gap-3 md:gap-4 mb-3 md:mb-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 flex-shrink-0 mx-auto sm:mx-0">
                  <img 
                    src="/backups.png" 
                    alt="Multiple encrypted backups" 
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="font-bold text-gray-900 mb-2 md:mb-3 text-sm sm:text-base md:text-lg">Your data has multiple encrypted backups</h3>
                  <p className="text-gray-700 text-xs sm:text-sm md:text-base leading-relaxed">
                    All data is backed up and versioned multiple times at secure locations across the world. We also employ a smart feature called point-in-time recovery to retrieve the data from a specific time period.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 md:p-8 hover:shadow-xl transition-all">
              <div className="flex flex-col sm:flex-row items-start gap-3 md:gap-4 mb-3 md:mb-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 flex-shrink-0 mx-auto sm:mx-0">
                  <img 
                    src="/share.png" 
                    alt="We don't sell your data" 
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="font-bold text-gray-900 mb-2 md:mb-3 text-sm sm:text-base md:text-lg">We don't sell your data</h3>
                  <p className="text-gray-700 text-xs sm:text-sm md:text-base leading-relaxed">
                    We are fully aware of the sensitivity of your healthcare information and take data privacy extremely seriously. We go to great lengths to protect it and will never ever sell it to anyone.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 md:p-8 hover:shadow-xl transition-all">
              <div className="flex flex-col sm:flex-row items-start gap-3 md:gap-4 mb-3 md:mb-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 flex-shrink-0 mx-auto sm:mx-0">
                  <img 
                    src="/patient.png" 
                    alt="Separate doctors and patients data" 
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="font-bold text-gray-900 mb-2 md:mb-3 text-sm sm:text-base md:text-lg">We never mix doctors' data with patients' data</h3>
                  <p className="text-gray-700 text-xs sm:text-sm md:text-base leading-relaxed">
                    Our platform uses industry-grade firewalls and follows a stringent privacy policy designed to keep providers' data separate from patients' data.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Secure Place Section */}
        <div className="mb-8 md:mb-12 lg:mb-16">
          <div className="flex flex-col lg:flex-row items-start gap-4 md:gap-6 lg:gap-8 mb-6 md:mb-8">
            <div className="flex-1 text-center lg:text-left">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-gray-900 mb-3 md:mb-4 tracking-tight px-2" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                Secure place for your health data
              </h2>
              <p className="text-sm sm:text-base md:text-lg text-gray-700 font-semibold mb-4 md:mb-6 px-2">
                Keeping your data safe is the core of every decision we make at MedClues
              </p>
            </div>
            
            {/* Large Shield Illustration */}
            <div className="flex-shrink-0 w-full lg:w-64 h-48 sm:h-56 md:h-64 flex items-center justify-center">
              <img 
                src="/data-security.png" 
                alt="Secure place for your health data" 
                className="w-full h-full object-contain"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 lg:gap-8">
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 md:p-8 hover:shadow-xl transition-all">
              <div className="flex flex-col sm:flex-row items-start gap-3 md:gap-4 mb-3 md:mb-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 flex-shrink-0 mx-auto sm:mx-0">
                  <img 
                    src="/pdata.png" 
                    alt="Your data is for your eyes only" 
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="font-bold text-gray-900 mb-2 md:mb-3 text-sm sm:text-base md:text-lg">Your data is for your eyes only</h3>
                  <p className="text-gray-700 text-xs sm:text-sm md:text-base leading-relaxed">
                    Anything that you share on MedClues is completely private. No one else can access it. We give an unprecedented level of control so that only you can decide who sees what.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 md:p-8 hover:shadow-xl transition-all">
              <div className="flex flex-col sm:flex-row items-start gap-3 md:gap-4 mb-3 md:mb-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 flex-shrink-0 mx-auto sm:mx-0">
                  <img 
                    src="/p256.png" 
                    alt="256-bit encryption" 
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="font-bold text-gray-900 mb-2 md:mb-3 text-sm sm:text-base md:text-lg">Everything is protected with 256-bit encryption</h3>
                  <p className="text-gray-700 text-xs sm:text-sm md:text-base leading-relaxed">
                    MedClues uses world-class standards to shield your data from unauthorized intrusion. It is always protected with multiple layers of encryption (256-bit encryption over the network).
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 md:p-8 hover:shadow-xl transition-all">
              <div className="flex flex-col sm:flex-row items-start gap-3 md:gap-4 mb-3 md:mb-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 flex-shrink-0 mx-auto sm:mx-0">
                  <img 
                    src="/p2fa.png" 
                    alt="Two-factor authentication" 
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="font-bold text-gray-900 mb-2 md:mb-3 text-sm sm:text-base md:text-lg">Two-factor authentication prevents unauthorized access</h3>
                  <p className="text-gray-700 text-xs sm:text-sm md:text-base leading-relaxed">
                    Extra measures are good. Therefore, we let you enable two-factor authentication so that your data is absolutely secure, and no one else can access it except you.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 md:p-8 hover:shadow-xl transition-all">
              <div className="flex flex-col sm:flex-row items-start gap-3 md:gap-4 mb-3 md:mb-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 flex-shrink-0 mx-auto sm:mx-0">
                  <img 
                    src="/logout.png" 
                    alt="Remote logout" 
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="font-bold text-gray-900 mb-2 md:mb-3 text-sm sm:text-base md:text-lg">Remote logout fends off suspicious logins</h3>
                  <p className="text-gray-700 text-xs sm:text-sm md:text-base leading-relaxed">
                    Whenever a new device logs into your account, MedClues notifies you immediately, so that you can review the activity and log out if needed.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FAQs Section */}
        <div className="mb-8 md:mb-12 lg:mb-16">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-6 md:mb-8 text-center px-2">
            FAQs
          </h2>
          
          <div className="grid grid-cols-1 gap-3 md:gap-4 lg:gap-6">
            {faqs.map((faq, index) => (
              <div 
                key={index} 
                className="bg-white rounded-xl shadow-lg p-4 sm:p-6 md:p-8 hover:shadow-xl transition-all duration-300"
              >
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full text-left flex items-start justify-between hover:text-cyan-600 transition-colors duration-200 gap-3"
                >
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base md:text-lg flex-1 pr-2">
                    {faq.question}
                  </h3>
                  <svg
                    className={`w-5 h-5 sm:w-6 sm:h-6 text-gray-600 flex-shrink-0 transition-transform duration-300 mt-0.5 ${
                      openFAQ === index ? 'transform rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    openFAQ === index 
                      ? 'max-h-[2000px] opacity-100 mt-3 md:mt-4' 
                      : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="pt-2">
                    <p className="text-gray-600 leading-relaxed text-xs sm:text-sm md:text-base">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}

export default DataSecurity

