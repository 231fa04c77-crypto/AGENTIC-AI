import React from 'react'
import BackButton from '../components/BackButton'
import BackArrow from '../components/BackArrow'

const PrivacyPolicy = () => {
  return (
    <div className="page-container fade-in">
      {/* Back Arrow Button */}
      <div className="mb-6 flex items-center gap-4">
        <BackArrow />
        <BackButton to="/" label="Back to Home" />
      </div>

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="section-header text-center mb-8">
          <h1 className="section-title">Privacy Policy</h1>
          <p className="section-subtitle">Last updated: November 2025</p>
        </div>

        {/* Content Card */}
        <div className="card">
          <div className="card-body space-y-8">
            {/* Introduction */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Introduction
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Welcome to MedClues Healthcare ("we," "our," or "us"). We are committed to protecting your personal information 
                and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your 
                information when you use our healthcare management platform.
              </p>
            </section>

            {/* Information We Collect */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Information We Collect
              </h2>
              <div className="space-y-4 text-gray-600">
                <p><strong className="text-gray-800">Personal Information:</strong> Name, email address, phone number, date of birth, and gender.</p>
                <p><strong className="text-gray-800">Medical Information:</strong> Health records, medical history, appointment details, prescriptions, and treatment information.</p>
                <p><strong className="text-gray-800">Payment Information:</strong> Billing address, payment method details (processed securely through third-party payment processors).</p>
                <p><strong className="text-gray-800">Usage Data:</strong> Information about how you interact with our platform, including IP address, browser type, and device information.</p>
              </div>
            </section>

            {/* How We Use Your Information */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                How We Use Your Information
              </h2>
              <ul className="list-disc list-inside space-y-2 text-gray-600 ml-4">
                <li>To facilitate appointment bookings and healthcare services</li>
                <li>To communicate with you about your appointments and health updates</li>
                <li>To process payments and send billing information</li>
                <li>To improve our platform and user experience</li>
                <li>To comply with legal and regulatory requirements</li>
                <li>To send promotional communications (with your consent)</li>
              </ul>
            </section>

            {/* Data Security */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Data Security
              </h2>
              <p className="text-gray-600 leading-relaxed">
                We implement industry-standard security measures to protect your personal and medical information. 
                This includes encryption, secure servers, and regular security audits. However, no method of 
                transmission over the internet is 100% secure, and we cannot guarantee absolute security.
              </p>
            </section>

            {/* Data Sharing */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Data Sharing
              </h2>
              <p className="text-gray-600 leading-relaxed mb-3">
                We do not sell your personal information. We may share your information with:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-600 ml-4">
                <li>Healthcare providers you choose to book appointments with</li>
                <li>Payment processors to complete transactions</li>
                <li>Service providers who assist in operating our platform</li>
                <li>Legal authorities when required by law</li>
              </ul>
            </section>

            {/* Your Rights */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Your Rights
              </h2>
              <p className="text-gray-600 leading-relaxed mb-3">You have the right to:</p>
              <ul className="list-disc list-inside space-y-2 text-gray-600 ml-4">
                <li>Access and receive a copy of your personal data</li>
                <li>Correct any inaccurate or incomplete data</li>
                <li>Request deletion of your personal data</li>
                <li>Object to or restrict processing of your data</li>
                <li>Data portability</li>
                <li>Withdraw consent at any time</li>
              </ul>
            </section>

            {/* Cookies */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                Cookies & Tracking
              </h2>
              <p className="text-gray-600 leading-relaxed">
                We use cookies and similar tracking technologies to improve your experience on our platform. 
                You can control cookie preferences through your browser settings. Essential cookies are 
                required for the platform to function properly.
              </p>
            </section>

            {/* Contact Us */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Contact Us
              </h2>
              <p className="text-gray-600 leading-relaxed">
                If you have any questions about this Privacy Policy or our data practices, please contact us at:
              </p>
              <div className="mt-3 p-4 bg-gray-50 rounded-lg">
                <p className="text-gray-700"><strong>Email:</strong> privacy@MedClues.com</p>
                <p className="text-gray-700"><strong>Phone:</strong> 1800-123-4567</p>
                <p className="text-gray-700"><strong>Address:</strong> MedClues Healthcare, India</p>
              </div>
            </section>

            {/* Updates */}
            <section className="pt-4 border-t">
              <p className="text-sm text-gray-500 text-center">
                We may update this Privacy Policy from time to time. We will notify you of any changes 
                by posting the new Privacy Policy on this page and updating the "Last updated" date.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PrivacyPolicy

