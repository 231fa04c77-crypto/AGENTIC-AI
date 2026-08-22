import React, { useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { toast } from 'react-toastify'
import BackButton from '../components/BackButton'
import BackArrow from '../components/BackArrow'

const Careers = () => {
  const { backendUrl } = useAppContext()

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    city: '',
    qualification: '',
    experience: '',
    role_applied: '',
    skills: '',
    coverLetter: ''
  })

  const [resumeFile, setResumeFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleResumeChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) {
      setResumeFile(null)
      return
    }

    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]

    if (!allowedTypes.includes(file.type)) {
      toast.error('Resume must be a PDF or Word document.')
      e.target.value = ''
      setResumeFile(null)
      return
    }

    const maxSizeBytes = 2 * 1024 * 1024 // 2MB
    if (file.size > maxSizeBytes) {
      toast.error('Resume file size must be 2MB or less.')
      e.target.value = ''
      setResumeFile(null)
      return
    }

    setResumeFile(file)
  }

  const validate = () => {
    if (!form.name.trim()) return 'Full Name is required.'
    if (!form.email.trim()) return 'Email is required.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Please enter a valid email address.'
    if (!form.phone.trim()) return 'Mobile Number is required.'
    if (!form.city.trim()) return 'City is required.'
    if (!form.qualification.trim()) return 'Highest Qualification is required.'
    if (!form.experience.trim()) return 'Years of Experience is required.'
    if (!form.role_applied.trim()) return 'Please select the role you are applying for.'
    if (!form.skills.trim()) return 'Please describe your skills.'
    if (!resumeFile) return 'Please upload your resume.'
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errorMsg = validate()
    if (errorMsg) {
      toast.error(errorMsg)
      return
    }

    try {
      setSubmitting(true)

      const formData = new FormData()
      formData.append('name', form.name.trim())
      formData.append('email', form.email.trim())
      formData.append('phone', form.phone.trim())
      formData.append('city', form.city.trim())
      formData.append('qualification', form.qualification.trim())
      formData.append('experience', form.experience.trim())
      formData.append('role_applied', form.role_applied.trim())
      formData.append('skills', form.skills.trim())
      if (form.coverLetter.trim()) {
        formData.append('coverLetter', form.coverLetter.trim())
      }
      if (resumeFile) {
        formData.append('resume', resumeFile)
      }

      const res = await fetch(`${backendUrl}/api/job-applications`, {
        method: 'POST',
        body: formData
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to submit application.')
      }

      toast.success('Application submitted successfully!')
      setForm({
        name: '',
        email: '',
        phone: '',
        city: '',
        qualification: '',
        experience: '',
        role_applied: '',
        skills: '',
        coverLetter: ''
      })
      setResumeFile(null)
      const fileInput = document.getElementById('resume-input')
      if (fileInput) fileInput.value = ''
    } catch (error) {
      console.error('Job application error:', error)
      toast.error(error.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-container fade-in">
      <div className="mb-6 flex items-center gap-4">
        <BackArrow />
        <BackButton to="/" label="Back to Home" />
      </div>

      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="section-title">
            Careers – <span className="text-cyan-500">Job Application</span>
          </h1>
          <p className="section-subtitle max-w-2xl mx-auto">
            Join MedClues and help us build the future of connected healthcare.
            Fill out the form below and our team will review your application.
          </p>
        </div>

        <div className="card p-6 sm:p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  name="name"
                  className="w-full"
                  value={form.name}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label className="form-label">Email *</label>
                <input
                  type="email"
                  name="email"
                  className="w-full"
                  value={form.email}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="form-label">Mobile Number *</label>
                <input
                  type="tel"
                  name="phone"
                  className="w-full"
                  value={form.phone}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label className="form-label">City *</label>
                <input
                  type="text"
                  name="city"
                  className="w-full"
                  value={form.city}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label className="form-label">Years of Experience *</label>
                <input
                  type="number"
                  name="experience"
                  min="0"
                  className="w-full"
                  value={form.experience}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Highest Qualification *</label>
                <input
                  type="text"
                  name="qualification"
                  className="w-full"
                  value={form.qualification}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label className="form-label">Applying For *</label>
                <select
                  name="role_applied"
                  className="w-full"
                  value={form.role_applied}
                  onChange={handleChange}
                >
                  <option value="">Select Role</option>
                  <option value="Doctor">Doctor</option>
                  <option value="Nurse">Nurse</option>
                  <option value="Developer">Developer</option>
                  <option value="Support">Support</option>
                  <option value="Other">Other</option>
                </select>
                {form.role_applied === 'Doctor' && (
                  <p className="mt-2 text-xs text-gray-500">
                    We&apos;re looking for compassionate physicians who are comfortable with digital tools,
                    electronic medical records, and collaborative care. Experience with tele-consultations,
                    patient education, and evidence-based protocols is highly valued.
                  </p>
                )}
                {form.role_applied === 'Nurse' && (
                  <p className="mt-2 text-xs text-gray-500">
                    MedClues nurses support both in-clinic and remote care workflows, coordinate with doctors,
                    and help patients navigate their ongoing treatment plans.
                  </p>
                )}
                {form.role_applied === 'Developer' && (
                  <p className="mt-2 text-xs text-gray-500">
                    Our engineering team builds secure, scalable healthcare platforms. Experience with modern
                    JavaScript frameworks, APIs, and cloud services is a strong plus.
                  </p>
                )}
                {form.role_applied === 'Support' && (
                  <p className="mt-2 text-xs text-gray-500">
                    Support roles focus on helping patients and doctors use our platform smoothly, resolving issues
                    quickly, and communicating with empathy.
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="form-label">Skills *</label>
              <textarea
                name="skills"
                rows="4"
                className="w-full resize-none"
                placeholder="Briefly describe your core skills, technologies, and experience."
                value={form.skills}
                onChange={handleChange}
              ></textarea>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Upload Resume (PDF / DOC, max 2MB) *</label>
                <input
                  id="resume-input"
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="w-full text-sm"
                  onChange={handleResumeChange}
                />
              </div>
              <div>
                <label className="form-label">Cover Letter (Optional)</label>
                <textarea
                  name="coverLetter"
                  rows="3"
                  className="w-full resize-none"
                  placeholder="You can briefly share why you’d like to join MedClues."
                  value={form.coverLetter}
                  onChange={handleChange}
                ></textarea>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                By submitting this form you agree to our processing of your data for recruitment purposes.
              </p>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Careers


