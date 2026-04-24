'use client';

import { useState, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { incubationApi } from '@/lib/supabase';

interface FormData {
  businessName: string;
  leadName: string;
  sjcetAssociated: string;
  sjcetAssociationType: string;
  age: string;
  resPhone: string;
  mobilePhone: string;
  email: string;
  postalAddress: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  qualification: string;
  specialization: string;
  institute: string;
  stageOfStartup: string;
  legalStatus: string;
  sectorDomain: string[];
  natureOfBusiness: string;
  innovationCategory: string;
  businessDescription: string;
  entrepreneurMotivation: string;
  teamDetails: string;
  companyDescription: string;
  productNovelty: string;
  competitors: string;
  competitiveAdvantage: string;
  marketSize: string;
  revenueModel: string;
  machineryRequired: string;
  machineryDetails: string;
  marketSurvey: string;
  marketSurveyDetails: string;
  researchValidation: string;
  projectCost: string;
  preOperativeExpenses: string;
  prototypeExpenses: string;
  testMarketing: string;
  equipment: string;
  workingCapital: string;
  otherRequirements: string;
  servicesExpected: string[];
  laboratoryAccess: boolean;
  libraryAccess: boolean;
  technicalConsulting: boolean;
  otherServices: string;
  reference1Name: string;
  reference1Organization: string;
  reference1Address: string;
  reference1Phone: string;
  reference1Email: string;
  reference2Name: string;
  reference2Organization: string;
  reference2Address: string;
  reference2Phone: string;
  reference2Email: string;
  declaration: boolean;
  date: string;
  place: string;
}

export default function IncubationForm() {
  const [formData, setFormData] = useState<FormData>({
    businessName: '',
    leadName: '',
    sjcetAssociated: '',
    sjcetAssociationType: '',
    age: '',
    resPhone: '',
    mobilePhone: '',
    email: '',
    postalAddress: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    qualification: '',
    specialization: '',
    institute: '',
    stageOfStartup: '',
    legalStatus: '',
    sectorDomain: [],
    natureOfBusiness: '',
    innovationCategory: '',
    businessDescription: '',
    entrepreneurMotivation: '',
    teamDetails: '',
    companyDescription: '',
    productNovelty: '',
    competitors: '',
    competitiveAdvantage: '',
    marketSize: '',
    revenueModel: '',
    machineryRequired: '',
    machineryDetails: '',
    marketSurvey: '',
    marketSurveyDetails: '',
    researchValidation: '',
    projectCost: '',
    preOperativeExpenses: '',
    prototypeExpenses: '',
    testMarketing: '',
    equipment: '',
    workingCapital: '',
    otherRequirements: '',
    servicesExpected: [],
    laboratoryAccess: false,
    libraryAccess: false,
    technicalConsulting: false,
    otherServices: '',
    reference1Name: '',
    reference1Organization: '',
    reference1Address: '',
    reference1Phone: '',
    reference1Email: '',
    reference2Name: '',
    reference2Organization: '',
    reference2Address: '',
    reference2Phone: '',
    reference2Email: '',
    declaration: false,
    date: '',
    place: '',
  });

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applicationId, setApplicationId] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checkbox = e.target as HTMLInputElement;
      setFormData(prev => ({
        ...prev,
        [name]: checkbox.checked
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleServicesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      servicesExpected: checked
        ? [...prev.servicesExpected, value]
        : prev.servicesExpected.filter(item => item !== value)
    }));
  };

  const handleSectorDomainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      sectorDomain: checked
        ? [...prev.sectorDomain, value]
        : prev.sectorDomain.filter(item => item !== value)
    }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    
    // Validate required fields
    if (!formData.declaration) {
      setError('Please accept the declaration to proceed');
      return;
    }

    if (!formData.businessName || !formData.leadName || !formData.email) {
      setError('Please fill in all required fields (marked with *)');
      return;
    }

    try {
      setSubmitting(true);
      
      // Prepare data for submission (convert to snake_case for database)
      const submissionData = {
        business_name: formData.businessName,
        lead_name: formData.leadName,
        sjcet_associated: formData.sjcetAssociated,
        sjcet_association_type: formData.sjcetAssociationType,
        age: formData.age ? parseInt(formData.age) : null,
        residential_phone: formData.resPhone,
        mobile_phone: formData.mobilePhone,
        email: formData.email,
        postal_address: formData.postalAddress,
        city: formData.city,
        state: formData.state,
        postal_code: formData.postalCode,
        country: formData.country,
        qualification: formData.qualification,
        specialization: formData.specialization,
        institute: formData.institute,
        stage_of_startup: formData.stageOfStartup,
        legal_status: formData.legalStatus,
        sector_domain: formData.sectorDomain,
        nature_of_business: formData.natureOfBusiness,
        innovation_category: formData.innovationCategory,
        business_description: formData.businessDescription,
        entrepreneurial_motivation: formData.entrepreneurMotivation,
        team_details: formData.teamDetails,
        company_description: formData.companyDescription,
        product_novelty: formData.productNovelty,
        competitors: formData.competitors,
        competitive_advantage: formData.competitiveAdvantage,
        market_size: formData.marketSize,
        revenue_model: formData.revenueModel,
        machinery_required: formData.machineryRequired,
        machinery_details: formData.machineryDetails,
        market_survey: formData.marketSurvey,
        market_survey_details: formData.marketSurveyDetails,
        research_validation: formData.researchValidation,
        project_cost: formData.projectCost ? parseFloat(formData.projectCost) : null,
        pre_operative_expenses: formData.preOperativeExpenses ? parseFloat(formData.preOperativeExpenses) : null,
        prototype_expenses: formData.prototypeExpenses ? parseFloat(formData.prototypeExpenses) : null,
        test_marketing: formData.testMarketing ? parseFloat(formData.testMarketing) : null,
        equipment: formData.equipment ? parseFloat(formData.equipment) : null,
        working_capital: formData.workingCapital ? parseFloat(formData.workingCapital) : null,
        other_requirements: formData.otherRequirements ? parseFloat(formData.otherRequirements) : null,
        laboratory_access: formData.laboratoryAccess,
        library_access: formData.libraryAccess,
        technical_consulting: formData.technicalConsulting,
        services_expected: formData.servicesExpected,
        other_services: formData.otherServices,
        declaration: formData.declaration,
        declaration_date: formData.date,
        declaration_place: formData.place
      };
      
      // Submit to Supabase
      const result = await incubationApi.submitApplication(submissionData);
      console.log('Application submitted successfully:', result);
      
      if (result && result[0]) {
        const appId = result[0].id;
        setApplicationId(appId);

        // Save references to application_references table
        const referencesToInsert = [
          {
            application_id: appId,
            reference_number: 1,
            name: formData.reference1Name || null,
            organization: formData.reference1Organization || null,
            address: formData.reference1Address || null,
            phone: formData.reference1Phone || null,
            email: formData.reference1Email || null,
          },
          {
            application_id: appId,
            reference_number: 2,
            name: formData.reference2Name || null,
            organization: formData.reference2Organization || null,
            address: formData.reference2Address || null,
            phone: formData.reference2Phone || null,
            email: formData.reference2Email || null,
          },
        ].filter(ref => ref.name || ref.organization || ref.email || ref.phone);

        if (referencesToInsert.length > 0) {
          await incubationApi.saveReferences(referencesToInsert);
        }
      }
      
      setSubmitted(true);
      setSubmitting(false);
      
      // Reset form after successful submission
      setTimeout(() => {
        setSubmitted(false);
        setApplicationId(null);
        setFormData({
          businessName: '',
          leadName: '',
          sjcetAssociated: '',
          sjcetAssociationType: '',
          age: '',
          resPhone: '',
          mobilePhone: '',
          email: '',
          postalAddress: '',
          city: '',
          state: '',
          postalCode: '',
          country: '',
          qualification: '',
          specialization: '',
          institute: '',
          stageOfStartup: '',
          legalStatus: '',
          sectorDomain: [],
          natureOfBusiness: '',
          innovationCategory: '',
          businessDescription: '',
          entrepreneurMotivation: '',
          teamDetails: '',
          companyDescription: '',
          productNovelty: '',
          competitors: '',
          competitiveAdvantage: '',
          marketSize: '',
          revenueModel: '',
          machineryRequired: '',
          machineryDetails: '',
          marketSurvey: '',
          marketSurveyDetails: '',
          researchValidation: '',
          projectCost: '',
          preOperativeExpenses: '',
          prototypeExpenses: '',
          testMarketing: '',
          equipment: '',
          workingCapital: '',
          otherRequirements: '',
          servicesExpected: [],
          laboratoryAccess: false,
          libraryAccess: false,
          technicalConsulting: false,
          otherServices: '',
          reference1Name: '',
          reference1Organization: '',
          reference1Address: '',
          reference1Phone: '',
          reference1Email: '',
          reference2Name: '',
          reference2Organization: '',
          reference2Address: '',
          reference2Phone: '',
          reference2Email: '',
          declaration: false,
          date: '',
          place: '',
        });
      }, 3000);
    } catch (err) {
      setSubmitting(false);
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit application. Please try again.';
      setError(errorMessage);
      console.error('Error submitting application:', {
        error: err,
        message: errorMessage,
        details: err instanceof Error ? err.stack : 'No stack trace'
      });
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4" style={{ fontFamily: 'var(--font-hanken-grotesk), sans-serif' }}>
        <Card className="w-full max-w-md border-0 shadow-lg">
          <div className="p-8 text-center">
            <div className="mb-4 flex justify-center">
              <div className="rounded-full bg-green-100 p-3">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h2 
              className="font-semibold mb-2"
              style={{
                fontFamily: '"Hanken Grotesk", sans-serif',
                fontSize: '28px',
                fontWeight: 600,
                color: '#4A4A4A'
              }}
            >
              Application Submitted!
            </h2>
            <p 
              className="mb-4"
              style={{
                fontFamily: '"Hanken Grotesk", sans-serif',
                color: '#8A8A8A',
                fontSize: '14px',
                lineHeight: '1.6'
              }}
            >
              Thank you for applying to SIIF Incubation Program. We will review your application and get back to you soon.
            </p>
            {applicationId && (
              <p 
                style={{
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  color: '#4A4A4A',
                  fontSize: '12px',
                  marginBottom: '12px',
                  backgroundColor: '#F5F6F7',
                  padding: '8px',
                  borderRadius: '4px'
                }}
              >
                <strong>Application ID:</strong> {applicationId}
              </p>
            )}
            <p 
              style={{
                fontFamily: '"Hanken Grotesk", sans-serif',
                color: '#9A9A9A',
                fontSize: '13px'
              }}
            >
              A confirmation email will be sent to {formData.email}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'var(--font-hanken-grotesk), sans-serif' }}>
      <div className="max-w-4xl mx-auto py-12 px-4 md:px-6">
        <motion.div className="mb-12 text-center">
          <h1 
            className="tracking-tighter mb-6"
            style={{
              fontFamily: '"Hanken Grotesk", sans-serif',
              fontSize: 'clamp(2rem, 5vw, 58px)',
              fontWeight: 600,
              lineHeight: '1.2',
              letterSpacing: '-2px',
              color: '#4A4A4A'
            }}
          >
            Apply for{' '}
            <span style={{
              background: 'linear-gradient(90deg, #2AA0D3 0%, #F00 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Incubation
            </span>
          </h1>
          <p 
            className="text-lg leading-relaxed max-w-3xl mx-auto"
            style={{
              color: '#565555',
              fontFamily: '"Hanken Grotesk", sans-serif',
              fontSize: 'clamp(0.95rem, 1.8vw, 16px)',
              fontWeight: 400,
              lineHeight: '1.6',
            }}
          >
            Join SIIF - Startups Valley TBI. Fill out this comprehensive application form to be considered for our incubation program.
          </p>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Section 1: Business Name */}
          <Card className="p-6 border-0 shadow">
            <h2 
              className="mb-6"
              style={{
                fontFamily: '"Hanken Grotesk", sans-serif',
                fontSize: '20px',
                fontWeight: 600,
                color: '#FF3B3B'
              }}
            >
              Business Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label 
                  className="block mb-2 font-medium"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#4A4A4A'
                  }}
                >
                  Name of Business <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="businessName"
                  value={formData.businessName}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '14px',
                    color: '#4A4A4A'
                  }}
                  required
                />
              </div>
            </div>
          </Card>

          {/* Section 2: Lead Entrepreneur */}
          <Card className="p-6 border-0 shadow">
            <h2 
              className="mb-6"
              style={{
                fontFamily: '"Hanken Grotesk", sans-serif',
                fontSize: '20px',
                fontWeight: 600,
                color: '#FF3B3B'
              }}
            >
              Lead Entrepreneur
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label 
                  className="block mb-2 font-medium"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#4A4A4A'
                  }}
                >
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="leadName"
                  value={formData.leadName}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '14px',
                    color: '#4A4A4A'
                  }}
                  required
                />
              </div>
            </div>

            <div className="mt-6">
              <label 
                className="block mb-3 font-medium"
                style={{
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#4A4A4A'
                }}
              >
                Are you associated with SJCET Palai? <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-6 mb-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="sjcetAssociated"
                    value="Yes"
                    checked={formData.sjcetAssociated === 'Yes'}
                    onChange={handleInputChange}
                    className="rounded-full border-gray-300 text-[#FF3B3B]"
                    required
                  />
                  <span 
                    className="ml-3 font-medium"
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '14px',
                      color: '#4A4A4A'
                    }}
                  >
                    Yes
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="sjcetAssociated"
                    value="No"
                    checked={formData.sjcetAssociated === 'No'}
                    onChange={handleInputChange}
                    className="rounded-full border-gray-300 text-[#FF3B3B]"
                    required
                  />
                  <span 
                    className="ml-3 font-medium"
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '14px',
                      color: '#4A4A4A'
                    }}
                  >
                    No
                  </span>
                </label>
              </div>

              {formData.sjcetAssociated === 'Yes' && (
                <div>
                  <label 
                    className="block mb-2 font-medium"
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: '#4A4A4A'
                    }}
                  >
                    Please select your category <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="sjcetAssociationType"
                    value={formData.sjcetAssociationType}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '14px',
                      color: '#4A4A4A'
                    }}
                    required={formData.sjcetAssociated === 'Yes'}
                  >
                    <option value="">-- Select Category --</option>
                    <option value="Student">Student</option>
                    <option value="Alumni">Alumni</option>
                    <option value="Faculty">Faculty</option>
                    <option value="Staff">Staff</option>
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div>
                <label 
                  className="block mb-2 font-medium"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#4A4A4A'
                  }}
                >
                  Age
                </label>
                <input
                  type="number"
                  name="age"
                  value={formData.age}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '14px',
                    color: '#4A4A4A'
                  }}
                />
              </div>
              <div>
                <label 
                  className="block mb-2 font-medium"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#4A4A4A'
                  }}
                >
                  Residential Phone
                </label>
                <input
                  type="tel"
                  name="resPhone"
                  value={formData.resPhone}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '14px',
                    color: '#4A4A4A'
                  }}
                />
              </div>
              <div>
                <label 
                  className="block mb-2 font-medium"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#4A4A4A'
                  }}
                >
                  Mobile Phone
                </label>
                <input
                  type="tel"
                  name="mobilePhone"
                  value={formData.mobilePhone}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '14px',
                    color: '#4A4A4A'
                  }}
                />
              </div>
              <div>
                <label 
                  className="block mb-2 font-medium"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#4A4A4A'
                  }}
                >
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '14px',
                    color: '#4A4A4A'
                  }}
                  required
                />
              </div>
              <div>
                <label 
                  className="block mb-2 font-medium"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#4A4A4A'
                  }}
                >
                  Postal Code
                </label>
                <input
                  type="text"
                  name="postalCode"
                  value={formData.postalCode}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '14px',
                    color: '#4A4A4A'
                  }}
                />
              </div>
              <div className="md:col-span-2">
                <label 
                  className="block mb-2 font-medium"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#4A4A4A'
                  }}
                >
                  Postal Address
                </label>
                <textarea
                  name="postalAddress"
                  value={formData.postalAddress}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '14px',
                    color: '#4A4A4A'
                  }}
                />
              </div>
              <div>
                <label 
                  className="block mb-2 font-medium"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#4A4A4A'
                  }}
                >
                  City
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '14px',
                    color: '#4A4A4A'
                  }}
                />
              </div>
              <div>
                <label 
                  className="block mb-2 font-medium"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#4A4A4A'
                  }}
                >
                  State
                </label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '14px',
                    color: '#4A4A4A'
                  }}
                />
              </div>
              <div>
                <label 
                  className="block mb-2 font-medium"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#4A4A4A'
                  }}
                >
                  Country
                </label>
                <input
                  type="text"
                  name="country"
                  value={formData.country}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '14px',
                    color: '#4A4A4A'
                  }}
                />
              </div>
            </div>
          </Card>

          {/* Section 3: Educational Qualification */}
          <Card className="p-6 border-0 shadow">
            <h2 
              className="mb-6"
              style={{
                fontFamily: '"Hanken Grotesk", sans-serif',
                fontSize: '20px',
                fontWeight: 600,
                color: '#FF3B3B'
              }}
            >
              Educational Qualification
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label 
                  className="block mb-2 font-medium"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#4A4A4A'
                  }}
                >
                  Qualification
                </label>
                <input
                  type="text"
                  name="qualification"
                  value={formData.qualification}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                  placeholder="e.g., B.Tech, MBA"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '14px',
                    color: '#4A4A4A'
                  }}
                />
              </div>
              <div>
                <label 
                  className="block mb-2 font-medium"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#4A4A4A'
                  }}
                >
                  Area of Specialization
                </label>
                <input
                  type="text"
                  name="specialization"
                  value={formData.specialization}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '14px',
                    color: '#4A4A4A'
                  }}
                />
              </div>
              <div className="md:col-span-2">
                <label 
                  className="block mb-2 font-medium"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#4A4A4A'
                  }}
                >
                  Name of Institute/University
                </label>
                <input
                  type="text"
                  name="institute"
                  value={formData.institute}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '14px',
                    color: '#4A4A4A'
                  }}
                />
              </div>
            </div>
          </Card>

          {/* Section 4: Type of Business - Detailed */}
          <Card className="p-6 border-0 shadow">
            <h2 
              className="mb-6"
              style={{
                fontFamily: '"Hanken Grotesk", sans-serif',
                fontSize: '20px',
                fontWeight: 600,
                color: '#FF3B3B'
              }}
            >
              Type of Business
            </h2>

            {/* 4.1 Stage of Startup */}
            <div className="mb-8 pb-6 border-b border-gray-200">
              <h3 
                className="mb-4 font-semibold"
                style={{
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  fontSize: '16px',
                  color: '#4A4A4A'
                }}
              >
                Stage of Startup
              </h3>
              <div className="space-y-3 ml-4">
                {['Idea Stage', 'Prototype / Proof of Concept (PoC)', 'Early Revenue Stage', 'Growth / Scaling Stage'].map((stage) => (
                  <label key={stage} className="flex items-center">
                    <input
                      type="radio"
                      name="stageOfStartup"
                      value={stage}
                      checked={formData.stageOfStartup === stage}
                      onChange={handleInputChange}
                      className="rounded-full border-gray-300 text-[#FF3B3B]"
                    />
                    <span 
                      className="ml-3 font-medium"
                      style={{
                        fontFamily: '"Hanken Grotesk", sans-serif',
                        fontSize: '14px',
                        color: '#4A4A4A'
                      }}
                    >
                      {stage}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* 4.2 Legal Status of the Entity */}
            <div className="mb-8 pb-6 border-b border-gray-200">
              <h3 
                className="mb-4 font-semibold"
                style={{
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  fontSize: '16px',
                  color: '#4A4A4A'
                }}
              >
                Legal Status of the Entity
              </h3>
              <div className="space-y-3 ml-4">
                {['Not Registered (Individual / Team)', 'Private Limited Company', 'Limited Liability Partnership (LLP)', 'Partnership Firm', 'Sole Proprietorship'].map((status) => (
                  <label key={status} className="flex items-center">
                    <input
                      type="radio"
                      name="legalStatus"
                      value={status}
                      checked={formData.legalStatus === status}
                      onChange={handleInputChange}
                      className="rounded-full border-gray-300 text-[#FF3B3B]"
                    />
                    <span 
                      className="ml-3 font-medium"
                      style={{
                        fontFamily: '"Hanken Grotesk", sans-serif',
                        fontSize: '14px',
                        color: '#4A4A4A'
                      }}
                    >
                      {status}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* 4.3 Sector / Domain */}
            <div className="mb-8 pb-6 border-b border-gray-200">
              <h3 
                className="mb-4 font-semibold"
                style={{
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  fontSize: '16px',
                  color: '#4A4A4A'
                }}
              >
                Sector / Domain
              </h3>
              <div className="space-y-3 ml-4">
                {[
                  'Information Technology / Software',
                  'Artificial Intelligence / Data Science',
                  'Electronics / IoT / Embedded Systems',
                  'Healthcare / MedTech',
                  'Agriculture / AgriTech',
                  'Education / EdTech',
                  'Clean Energy / Sustainability',
                  'Manufacturing / Hardware',
                  'FinTech',
                  'Social Impact / Non-profit',
                  'Other'
                ].map((sector) => (
                  <label key={sector} className="flex items-center">
                    <input
                      type="checkbox"
                      value={sector}
                      checked={formData.sectorDomain.includes(sector)}
                      onChange={handleSectorDomainChange}
                      className="rounded border-gray-300 text-[#FF3B3B]"
                    />
                    <span 
                      className="ml-3 font-medium"
                      style={{
                        fontFamily: '"Hanken Grotesk", sans-serif',
                        fontSize: '14px',
                        color: '#4A4A4A'
                      }}
                    >
                      {sector}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* 4.4 Nature of Business */}
            <div className="mb-8 pb-6 border-b border-gray-200">
              <h3 
                className="mb-4 font-semibold"
                style={{
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  fontSize: '16px',
                  color: '#4A4A4A'
                }}
              >
                Nature of Business
              </h3>
              <div className="space-y-3 ml-4">
                {['Product-based', 'Service-based', 'Platform / Marketplace', 'Research & IP-driven', 'Hybrid (Product + Service)'].map((nature) => (
                  <label key={nature} className="flex items-center">
                    <input
                      type="radio"
                      name="natureOfBusiness"
                      value={nature}
                      checked={formData.natureOfBusiness === nature}
                      onChange={handleInputChange}
                      className="rounded-full border-gray-300 text-[#FF3B3B]"
                    />
                    <span 
                      className="ml-3 font-medium"
                      style={{
                        fontFamily: '"Hanken Grotesk", sans-serif',
                        fontSize: '14px',
                        color: '#4A4A4A'
                      }}
                    >
                      {nature}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* 4.5 Innovation Category */}
            <div className="mb-8 pb-6 border-b border-gray-200">
              <h3 
                className="mb-4 font-semibold"
                style={{
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  fontSize: '16px',
                  color: '#4A4A4A'
                }}
              >
                Innovation Category
              </h3>
              <div className="space-y-3 ml-4">
                {['Technology-driven innovation', 'Process innovation', 'Business model innovation', 'Social innovation'].map((innovation) => (
                  <label key={innovation} className="flex items-center">
                    <input
                      type="radio"
                      name="innovationCategory"
                      value={innovation}
                      checked={formData.innovationCategory === innovation}
                      onChange={handleInputChange}
                      className="rounded-full border-gray-300 text-[#FF3B3B]"
                    />
                    <span 
                      className="ml-3 font-medium"
                      style={{
                        fontFamily: '"Hanken Grotesk", sans-serif',
                        fontSize: '14px',
                        color: '#4A4A4A'
                      }}
                    >
                      {innovation}
                    </span>
                  </label>
                ))}
              </div>
            </div>


          </Card>

          {/* Section 5: Business Description */}
          <Card className="p-6 border-0 shadow">
            <h2 
              className="mb-6"
              style={{
                fontFamily: '"Hanken Grotesk", sans-serif',
                fontSize: '20px',
                fontWeight: 600,
                color: '#FF3B3B'
              }}
            >
              Business Description
            </h2>
            <div>
              <label 
                className="block mb-2 font-medium"
                style={{
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#4A4A4A'
                }}
              >
                Briefly describe your business
              </label>
              <textarea
                name="businessDescription"
                value={formData.businessDescription}
                onChange={handleInputChange}
                rows={5}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                placeholder="Provide detailed description of your business..."
                style={{
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  fontSize: '14px',
                  color: '#4A4A4A'
                }}
              />
            </div>
          </Card>





          {/* Section 8: Entrepreneurial Motivation */}
          <Card className="p-6 border-0 shadow">
            <h2 
              className="mb-6"
              style={{
                fontFamily: '"Hanken Grotesk", sans-serif',
                fontSize: '20px',
                fontWeight: 600,
                color: '#FF3B3B'
              }}
            >
              Why Do You Want to Become an Entrepreneur?
            </h2>
            <div>
              <textarea
                name="entrepreneurMotivation"
                value={formData.entrepreneurMotivation}
                onChange={handleInputChange}
                rows={5}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                placeholder="Explain your motivation to start this business..."
                style={{
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  fontSize: '14px',
                  color: '#4A4A4A'
                }}
              />
            </div>
          </Card>

          {/* Section 9: Team Details */}
          <Card className="p-6 border-0 shadow">
            <h2 
              className="mb-6"
              style={{
                fontFamily: '"Hanken Grotesk", sans-serif',
                fontSize: '20px',
                fontWeight: 600,
                color: '#FF3B3B'
              }}
            >
              Team Details & Employees
            </h2>
            <div>
              <label 
                className="block mb-2 font-medium"
                style={{
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#4A4A4A'
                }}
              >
                Describe your team and number of employees you will be employing
              </label>
              <textarea
                name="teamDetails"
                value={formData.teamDetails}
                onChange={handleInputChange}
                rows={5}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                placeholder="Include team members, their expertise, and planned employees..."
                style={{
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  fontSize: '14px',
                  color: '#4A4A4A'
                }}
              />
            </div>
          </Card>

          {/* Section 10: Company and Product */}
          <Card className="p-6 border-0 shadow">
            <h2 
              className="mb-6"
              style={{
                fontFamily: '"Hanken Grotesk", sans-serif',
                fontSize: '20px',
                fontWeight: 600,
                color: '#FF3B3B'
              }}
            >
              Company and Product/Service
            </h2>
            <div>
              <label 
                className="block mb-2 font-medium"
                style={{
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#4A4A4A'
                }}
              >
                Briefly describe the company and product/service offered
              </label>
              <textarea
                name="companyDescription"
                value={formData.companyDescription}
                onChange={handleInputChange}
                rows={5}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                placeholder="Describe your company vision and the products or services you offer..."
                style={{
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  fontSize: '14px',
                  color: '#4A4A4A'
                }}
              />
            </div>
          </Card>

          {/* Section 11: Product Novelty */}
          <Card className="p-6 border-0 shadow">
            <h2 
              className="mb-6"
              style={{
                fontFamily: '"Hanken Grotesk", sans-serif',
                fontSize: '20px',
                fontWeight: 600,
                color: '#FF3B3B'
              }}
            >
              Novelty of Your Product/Service
            </h2>
            <div>
              <textarea
                name="productNovelty"
                value={formData.productNovelty}
                onChange={handleInputChange}
                rows={5}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                placeholder="Explain what makes your product/service unique and innovative..."
                style={{
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  fontSize: '14px',
                  color: '#4A4A4A'
                }}
              />
            </div>
          </Card>

          {/* Section 12: Competition */}
          <Card className="p-6 border-0 shadow">
            <h2 
              className="mb-6"
              style={{
                fontFamily: '"Hanken Grotesk", sans-serif',
                fontSize: '20px',
                fontWeight: 600,
                color: '#FF3B3B'
              }}
            >
              Competitors & Competitive Advantage
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label 
                  className="block mb-2 font-medium"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#4A4A4A'
                  }}
                >
                  Who are your competitors?
                </label>
                <textarea
                  name="competitors"
                  value={formData.competitors}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                  placeholder="List your main competitors..."
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '14px',
                    color: '#4A4A4A'
                  }}
                />
              </div>
              <div>
                <label 
                  className="block mb-2 font-medium"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#4A4A4A'
                  }}
                >
                  What is your competitive advantage?
                </label>
                <textarea
                  name="competitiveAdvantage"
                  value={formData.competitiveAdvantage}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                  placeholder="Explain your unique advantages over competitors..."
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '14px',
                    color: '#4A4A4A'
                  }}
                />
              </div>
            </div>
          </Card>

          {/* Section 13: Market Size */}
          <Card className="p-6 border-0 shadow">
            <h2 
              className="mb-6"
              style={{
                fontFamily: '"Hanken Grotesk", sans-serif',
                fontSize: '20px',
                fontWeight: 600,
                color: '#FF3B3B'
              }}
            >
              Potential Market Size
            </h2>
            <div>
              <textarea
                name="marketSize"
                value={formData.marketSize}
                onChange={handleInputChange}
                rows={5}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                placeholder="Describe the potential market size for your product/service..."
                style={{
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  fontSize: '14px',
                  color: '#4A4A4A'
                }}
              />
            </div>
          </Card>

          {/* Section 14: Revenue Model */}
          <Card className="p-6 border-0 shadow">
            <h2 
              className="mb-6"
              style={{
                fontFamily: '"Hanken Grotesk", sans-serif',
                fontSize: '20px',
                fontWeight: 600,
                color: '#FF3B3B'
              }}
            >
              Revenue Model
            </h2>
            <div>
              <textarea
                name="revenueModel"
                value={formData.revenueModel}
                onChange={handleInputChange}
                rows={5}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                placeholder="Explain your revenue generation model and pricing strategy..."
                style={{
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  fontSize: '14px',
                  color: '#4A4A4A'
                }}
              />
            </div>
          </Card>

          {/* Section 15: Machinery & Capital */}
          <Card className="p-6 border-0 shadow">
            <h2 
              className="mb-6"
              style={{
                fontFamily: '"Hanken Grotesk", sans-serif',
                fontSize: '20px',
                fontWeight: 600,
                color: '#FF3B3B'
              }}
            >
              Machinery or Capital Items
            </h2>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="machineryRequired"
                    value="yes"
                    checked={formData.machineryRequired === 'yes'}
                    onChange={handleInputChange}
                    className="rounded-full border-gray-300 text-[#FF3B3B]"
                  />
                  <span 
                    className="ml-3 font-medium"
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '14px',
                      color: '#4A4A4A'
                    }}
                  >
                    Yes
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="machineryRequired"
                    value="no"
                    checked={formData.machineryRequired === 'no'}
                    onChange={handleInputChange}
                    className="rounded-full border-gray-300 text-[#FF3B3B]"
                  />
                  <span 
                    className="ml-3 font-medium"
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '14px',
                      color: '#4A4A4A'
                    }}
                  >
                    No
                  </span>
                </label>
              </div>
              {formData.machineryRequired === 'yes' && (
                <div>
                  <label 
                    className="block mb-2 font-medium"
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: '#4A4A4A'
                    }}
                  >
                    Specify machinery with purpose
                  </label>
                  <textarea
                    name="machineryDetails"
                    value={formData.machineryDetails}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                    placeholder="List machinery/capital items with their purpose and estimated cost..."
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '14px',
                      color: '#4A4A4A'
                    }}
                  />
                </div>
              )}
            </div>
          </Card>

          {/* Section 16: Market Survey */}
          <Card className="p-6 border-0 shadow">
            <h2 
              className="mb-6"
              style={{
                fontFamily: '"Hanken Grotesk", sans-serif',
                fontSize: '20px',
                fontWeight: 600,
                color: '#FF3B3B'
              }}
            >
              Market Survey
            </h2>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="marketSurvey"
                    value="yes"
                    checked={formData.marketSurvey === 'yes'}
                    onChange={handleInputChange}
                    className="rounded-full border-gray-300 text-[#FF3B3B]"
                  />
                  <span 
                    className="ml-3 font-medium"
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '14px',
                      color: '#4A4A4A'
                    }}
                  >
                    Yes
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="marketSurvey"
                    value="no"
                    checked={formData.marketSurvey === 'no'}
                    onChange={handleInputChange}
                    className="rounded-full border-gray-300 text-[#FF3B3B]"
                  />
                  <span 
                    className="ml-3 font-medium"
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '14px',
                      color: '#4A4A4A'
                    }}
                  >
                    No
                  </span>
                </label>
              </div>
              {formData.marketSurvey === 'yes' && (
                <div>
                  <label 
                    className="block mb-2 font-medium"
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: '#4A4A4A'
                    }}
                  >
                    Give Details
                  </label>
                  <textarea
                    name="marketSurveyDetails"
                    value={formData.marketSurveyDetails}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                    placeholder="Provide details of your market survey findings..."
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '14px',
                      color: '#4A4A4A'
                    }}
                  />
                </div>
              )}
            </div>
          </Card>

          {/* Section 17: Research Validation */}
          <Card className="p-6 border-0 shadow">
            <h2 
              className="mb-6"
              style={{
                fontFamily: '"Hanken Grotesk", sans-serif',
                fontSize: '20px',
                fontWeight: 600,
                color: '#FF3B3B'
              }}
            >
              Research & Validation
            </h2>
            <div>
              <label 
                className="block mb-2 font-medium"
                style={{
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#4A4A4A'
                }}
              >
                Have you done research to validate your assumption? Give details.
              </label>
              <textarea
                name="researchValidation"
                value={formData.researchValidation}
                onChange={handleInputChange}
                rows={5}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                placeholder="Describe your research and validation results..."
                style={{
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  fontSize: '14px',
                  color: '#4A4A4A'
                }}
              />
            </div>
          </Card>

          {/* Section 18: Project Cost */}
          <Card className="p-6 border-0 shadow">
            <h2 
              className="mb-6"
              style={{
                fontFamily: '"Hanken Grotesk", sans-serif',
                fontSize: '20px',
                fontWeight: 600,
                color: '#FF3B3B'
              }}
            >
              Estimated Project Cost (In Detail)
            </h2>
            <div className="space-y-4">
              <div>
                <label 
                  className="block mb-2 font-medium"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#4A4A4A'
                  }}
                >
                  Total Project Cost (Rs.)
                </label>
                <input
                  type="number"
                  name="projectCost"
                  value={formData.projectCost}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                  placeholder="0.00"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '14px',
                    color: '#4A4A4A'
                  }}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label 
                    className="block mb-2 font-medium"
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: '#4A4A4A'
                    }}
                  >
                    Pre-operative Expenses (Rs.)
                  </label>
                  <input
                    type="number"
                    name="preOperativeExpenses"
                    value={formData.preOperativeExpenses}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '14px',
                      color: '#4A4A4A'
                    }}
                  />
                </div>
                <div>
                  <label 
                    className="block mb-2 font-medium"
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: '#4A4A4A'
                    }}
                  >
                    Prototype Development (Rs.)
                  </label>
                  <input
                    type="number"
                    name="prototypeExpenses"
                    value={formData.prototypeExpenses}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '14px',
                      color: '#4A4A4A'
                    }}
                  />
                </div>
                <div>
                  <label 
                    className="block mb-2 font-medium"
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: '#4A4A4A'
                    }}
                  >
                    Test & Marketing (Rs.)
                  </label>
                  <input
                    type="number"
                    name="testMarketing"
                    value={formData.testMarketing}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '14px',
                      color: '#4A4A4A'
                    }}
                  />
                </div>
                <div>
                  <label 
                    className="block mb-2 font-medium"
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: '#4A4A4A'
                    }}
                  >
                    Equipment (Rs.)
                  </label>
                  <input
                    type="number"
                    name="equipment"
                    value={formData.equipment}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '14px',
                      color: '#4A4A4A'
                    }}
                  />
                </div>
                <div>
                  <label 
                    className="block mb-2 font-medium"
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: '#4A4A4A'
                    }}
                  >
                    Working Capital (Rs.)
                  </label>
                  <input
                    type="number"
                    name="workingCapital"
                    value={formData.workingCapital}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '14px',
                      color: '#4A4A4A'
                    }}
                  />
                </div>
                <div>
                  <label 
                    className="block mb-2 font-medium"
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: '#4A4A4A'
                    }}
                  >
                    Other Requirements (Rs.)
                  </label>
                  <input
                    type="number"
                    name="otherRequirements"
                    value={formData.otherRequirements}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '14px',
                      color: '#4A4A4A'
                    }}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Section 18b: Services Expected */}
          <Card className="p-6 border-0 shadow">
            <h2 
              className="mb-6"
              style={{
                fontFamily: '"Hanken Grotesk", sans-serif',
                fontSize: '20px',
                fontWeight: 600,
                color: '#FF3B3B'
              }}
            >
              Services Expected from SIIF TBI
            </h2>
            <div className="space-y-4">
              <div>
                <h3 
                  className="font-semibold mb-3"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '14px',
                    color: '#4A4A4A'
                  }}
                >
                  Infrastructure Access
                </h3>
                <div className="space-y-2">
                  {[
                    { id: 'laboratoryAccess', label: 'Laboratory Access' },
                    { id: 'libraryAccess', label: 'Library Access' },
                    { id: 'technicalConsulting', label: 'Technical Consulting Service' }
                  ].map((item) => (
                    <label key={item.id} className="flex items-center">
                      <input
                        type="checkbox"
                        name={item.id}
                        checked={formData[item.id as keyof FormData] as boolean}
                        onChange={handleInputChange}
                        className="rounded border-gray-300 text-[#FF3B3B]"
                      />
                      <span 
                        className="ml-3 font-medium"
                        style={{
                          fontFamily: '"Hanken Grotesk", sans-serif',
                          fontSize: '14px',
                          color: '#4A4A4A'
                        }}
                      >
                        {item.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <h3 
                  className="font-semibold mb-3"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '14px',
                    color: '#4A4A4A'
                  }}
                >
                  Consulting Services
                </h3>
                <div className="space-y-2">
                  {[
                    'Market Assessment/Feasibility',
                    'Techno-Economic Study',
                    'Process/Product Development',
                    'Product Evaluation & Benchmarking',
                    'IPR Related Assistance',
                    'Advisory Services',
                    'Branding and Marketing'
                  ].map((service) => (
                    <label key={service} className="flex items-center">
                      <input
                        type="checkbox"
                        value={service}
                        checked={formData.servicesExpected.includes(service)}
                        onChange={handleServicesChange}
                        className="rounded border-gray-300 text-[#FF3B3B]"
                      />
                      <span 
                        className="ml-3 font-medium"
                        style={{
                          fontFamily: '"Hanken Grotesk", sans-serif',
                          fontSize: '14px',
                          color: '#4A4A4A'
                        }}
                      >
                        {service}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label 
                  className="block mb-2 font-medium"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#4A4A4A'
                  }}
                >
                  Other Services/Requirements
                </label>
                <textarea
                  name="otherServices"
                  value={formData.otherServices}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                  placeholder="Specify any other services or requirements..."
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '14px',
                    color: '#4A4A4A'
                  }}
                />
              </div>
            </div>
          </Card>

          {/* Section 19: References */}
          <Card className="p-6 border-0 shadow">
            <h2 
              className="mb-6"
              style={{
                fontFamily: '"Hanken Grotesk", sans-serif',
                fontSize: '20px',
                fontWeight: 600,
                color: '#FF3B3B'
              }}
            >
              References
            </h2>
            
            {[1, 2].map((refNum) => (
              <div key={refNum} className="mb-8 pb-8 border-b border-gray-200 last:border-b-0">
                <h3 
                  className="font-semibold mb-4"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    fontSize: '14px',
                    color: '#4A4A4A'
                  }}
                >
                  Reference {refNum}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label 
                      className="block mb-2 font-medium"
                      style={{
                        fontFamily: '"Hanken Grotesk", sans-serif',
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#4A4A4A'
                      }}
                    >
                      Name
                    </label>
                    <input
                      type="text"
                      name={`reference${refNum}Name`}
                      value={formData[`reference${refNum}Name` as keyof FormData] as string}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                      style={{
                        fontFamily: '"Hanken Grotesk", sans-serif',
                        fontSize: '14px',
                        color: '#4A4A4A'
                      }}
                    />
                  </div>
                  <div>
                    <label 
                      className="block mb-2 font-medium"
                      style={{
                        fontFamily: '"Hanken Grotesk", sans-serif',
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#4A4A4A'
                      }}
                    >
                      Organization/Designation
                    </label>
                    <input
                      type="text"
                      name={`reference${refNum}Organization`}
                      value={formData[`reference${refNum}Organization` as keyof FormData] as string}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                      style={{
                        fontFamily: '"Hanken Grotesk", sans-serif',
                        fontSize: '14px',
                        color: '#4A4A4A'
                      }}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label 
                      className="block mb-2 font-medium"
                      style={{
                        fontFamily: '"Hanken Grotesk", sans-serif',
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#4A4A4A'
                      }}
                    >
                      Address
                    </label>
                    <input
                      type="text"
                      name={`reference${refNum}Address`}
                      value={formData[`reference${refNum}Address` as keyof FormData] as string}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                      style={{
                        fontFamily: '"Hanken Grotesk", sans-serif',
                        fontSize: '14px',
                        color: '#4A4A4A'
                      }}
                    />
                  </div>
                  <div>
                    <label 
                      className="block mb-2 font-medium"
                      style={{
                        fontFamily: '"Hanken Grotesk", sans-serif',
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#4A4A4A'
                      }}
                    >
                      Phone
                    </label>
                    <input
                      type="tel"
                      name={`reference${refNum}Phone`}
                      value={formData[`reference${refNum}Phone` as keyof FormData] as string}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                      style={{
                        fontFamily: '"Hanken Grotesk", sans-serif',
                        fontSize: '14px',
                        color: '#4A4A4A'
                      }}
                    />
                  </div>
                  <div>
                    <label 
                      className="block mb-2 font-medium"
                      style={{
                        fontFamily: '"Hanken Grotesk", sans-serif',
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#4A4A4A'
                      }}
                    >
                      Email
                    </label>
                    <input
                      type="email"
                      name={`reference${refNum}Email`}
                      value={formData[`reference${refNum}Email` as keyof FormData] as string}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                      style={{
                        fontFamily: '"Hanken Grotesk", sans-serif',
                        fontSize: '14px',
                        color: '#4A4A4A'
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </Card>

          {/* Section 20: Declaration */}
          <Card className="p-6 border-0 shadow">
            <h2 
              className="mb-6"
              style={{
                fontFamily: '"Hanken Grotesk", sans-serif',
                fontSize: '20px',
                fontWeight: 600,
                color: '#FF3B3B'
              }}
            >
              Declaration
            </h2>
            <div className="space-y-4">
              <div 
                className="border border-gray-300 rounded-lg p-4"
                style={{
                  backgroundColor: '#F5F6F7'
                }}
              >
                <p 
                  className="text-sm"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    color: '#4A4A4A',
                    fontSize: '13px',
                    lineHeight: '1.6'
                  }}
                >
                  <span style={{ fontWeight: 600 }}>Declaration:</span> The information that I/we have provided is correct. 
                  I further declare that the information provided herewith is not proprietary in nature and that I would 
                  not make any claim on the same. I have read and understood and accepted the terms and conditions set 
                  forth in the disclaimer.
                </p>
              </div>
              <label className="flex items-start">
                <input
                  type="checkbox"
                  name="declaration"
                  checked={formData.declaration}
                  onChange={handleInputChange}
                  className="mt-1 rounded border-gray-300 text-[#FF3B3B]"
                  required
                />
                <span 
                  className="ml-3 text-sm"
                  style={{
                    fontFamily: '"Hanken Grotesk", sans-serif',
                    color: '#4A4A4A',
                    fontSize: '13px'
                  }}
                >
                  I confirm that the above declaration is true and I accept the terms and conditions <span className="text-red-500">*</span>
                </span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div>
                  <label 
                    className="block mb-2 font-medium"
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: '#4A4A4A'
                    }}
                  >
                    Date
                  </label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '14px',
                      color: '#4A4A4A'
                    }}
                  />
                </div>
                <div>
                  <label 
                    className="block mb-2 font-medium"
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: '#4A4A4A'
                    }}
                  >
                    Place
                  </label>
                  <input
                    type="text"
                    name="place"
                    value={formData.place}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '14px',
                      color: '#4A4A4A'
                    }}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Submit Button */}
          <div className="flex flex-col gap-4">
            {error && (
              <div 
                className="p-4 rounded-lg border border-red-300"
                style={{
                  backgroundColor: '#FFE5E5',
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  color: '#D32F2F',
                  fontSize: '14px'
                }}
              >
                <strong>Error:</strong> {error}
              </div>
            )}
            <div className="flex justify-between gap-4">
              <Button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                disabled={submitting}
                className="px-8 py-2 border-none rounded-full font-semibold transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  fontFamily: 'var(--font-hanken-grotesk)',
                  background: 'rgba(213, 213, 213, 0.49)',
                  color: '#070707'
                }}
              >
                Back to Top
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="px-8 py-3 text-white font-bold shadow-xl transition-all hover:scale-105 active:scale-95 border-none disabled:opacity-70 disabled:cursor-not-allowed"
                style={{
                  fontFamily: 'var(--font-hanken-grotesk)',
                  borderRadius: '74px',
                  fontSize: '16px',
                  background: 'radial-gradient(76.17% 53.63% at 47.52% 111.03%, #8F1D5D 0%, rgba(102, 102, 102, 0.00) 100%), linear-gradient(90deg, #700333 0%, #E81116 100%)'
                }}
              >
                {submitting ? 'Submitting...' : 'Submit Application'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
