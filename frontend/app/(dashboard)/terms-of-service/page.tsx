"use client";

import Footer from "@/components/Footer";
import Image from "next/image";
import Link from "next/link";

export default function TermsOfService() {
  const sections = [
    {
      number: "1",
      title: "About Capturing Story Gems",
      content: (
        <>
          <p className="mb-4">
            Capturing Story Gems provides educational resources, software tools,
            guided programs, coaching, story development assistance, digital
            storybooks, hardcover storybook services, and related products
            designed to help individuals preserve meaningful memories and create
            personal stories.
          </p>
          <p>
            We reserve the right to modify, update, or discontinue any portion
            of our Services at any time.
          </p>
        </>
      ),
    },
    {
      number: "2",
      title: "Intellectual Property",
      content: (
        <>
          <p className="mb-4">
            All content provided through CSG, including but not limited to:
          </p>
          <ul className="space-y-2 ml-5 mb-4">
            {[
              "Text",
              "Graphics",
              "Logos",
              "Images",
              "Videos",
              "Audio recordings",
              "Course materials",
              "Worksheets",
              "Templates",
              "Software",
              "Training materials",
              "Storybook designs",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-[#457B9D] font-bold">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mb-4">
            is protected by copyright, trademark, and other intellectual property
            laws.
          </p>
          <p className="mb-4">
            Unless otherwise stated, these materials belong to Capturing Story
            Gems and may not be copied, reproduced, distributed, modified, sold,
            or used commercially without our written permission.
          </p>
          <p>
            You may download and use CSG materials for your personal,
            non-commercial use only.
          </p>
        </>
      ),
    },
    {
      number: "3",
      title: "Your Stories and Content",
      content: (
        <>
          <p className="mb-4">
            You retain ownership of the stories, memories, photographs, audio
            recordings, and other content you submit to CSG.
          </p>
          <p className="mb-4">
            By submitting content, you grant CSG permission to use that content
            solely for the purpose of providing requested Services, including:
          </p>
          <ul className="space-y-2 ml-5 mb-4">
            {[
              "Story development assistance",
              "Storybook creation",
              "Digital storybook generation",
              "Hardcover book publishing and printing",
              "Customer support",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-[#457B9D] font-bold">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p>
            CSG will not publish, share, or publicly distribute your personal
            content without your permission except as required by law.
          </p>
        </>
      ),
    },
    {
      number: "4",
      title: "Acceptable Use",
      content: (
        <>
          <p className="mb-4">By using CSG, you agree not to:</p>
          <ul className="space-y-2 ml-5 mb-4">
            {[
              "Violate any laws or regulations",
              "Upload content that infringes on another person's rights",
              "Transmit harmful software, viruses, or malicious code",
              "Harass, abuse, or harm others",
              "Use the Services for fraudulent purposes",
              "Attempt to gain unauthorized access to our systems",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-[#457B9D] font-bold">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p>
            We reserve the right to suspend or terminate access for users who
            violate these Terms.
          </p>
        </>
      ),
    },
    {
      number: "5",
      title: "Digital Storybooks and Hardcover Storybooks",
      content: (
        <>
          <p className="mb-4">
            CSG offers both Digital PDF Storybooks and Hardcover Storybook
            services.
          </p>
          <p className="mb-4">
            While we strive for accuracy and quality, users are responsible for
            reviewing story content, images, names, dates, and other information
            before final approval.
          </p>
          <p className="mb-4">
            Hardcover storybooks are produced through trusted third-party
            publishing and printing partners.
          </p>
          <p>
            Production schedules, shipping timelines, and printing costs may vary
            based on publisher requirements and availability.
          </p>
        </>
      ),
    },
    {
      number: "6",
      title: "External Links",
      content: (
        <>
          <p className="mb-4">
            Our website may contain links to third-party websites or resources
            for your convenience.
          </p>
          <p className="mb-4">
            CSG is not responsible for the content, policies, services, or
            practices of third-party websites.
          </p>
          <p>
            Accessing those websites is done at your own discretion and subject
            to their terms and privacy policies.
          </p>
        </>
      ),
    },
    {
      number: "7",
      title: "Educational Purpose",
      content: (
        <>
          <p className="mb-4">
            CSG is designed to provide educational, creative, and
            memory-preservation resources.
          </p>
          <p className="mb-4">
            We do not provide legal, financial, medical, mental health, or
            professional counseling services.
          </p>
          <p>
            Any information provided through our Services should not be
            considered a substitute for professional advice.
          </p>
        </>
      ),
    },
    {
      number: "8",
      title: "Disclaimer of Warranties",
      content: (
        <>
          <p className="mb-4">
            CSG Services are provided on an &quot;as is&quot; and &quot;as
            available&quot; basis.
          </p>
          <p className="mb-4">
            While we strive to provide reliable and valuable Services, we do not
            guarantee that:
          </p>
          <ul className="space-y-2 ml-5 mb-4">
            {[
              "The website will always be available or error-free",
              "The Services will meet every user's expectations",
              "Story creation or storybook results will produce specific personal, emotional, or business outcomes",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-[#457B9D] font-bold">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p>Your use of the Services is at your own risk.</p>
        </>
      ),
    },
    {
      number: "9",
      title: "Limitation of Liability",
      content: (
        <>
          <p className="mb-4">
            To the fullest extent permitted by law, Capturing Story Gems and its
            owners, employees, contractors, affiliates, and partners shall not
            be liable for any indirect, incidental, consequential, special, or
            punitive damages arising from your use of the Services.
          </p>
          <p>
            Our total liability shall not exceed the amount you paid for the
            specific Service giving rise to the claim.
          </p>
        </>
      ),
    },
    {
      number: "10",
      title: "Changes to These Terms",
      content: (
        <>
          <p className="mb-4">We may update these Terms from time to time.</p>
          <p>
            Any updates will be posted on this page with a revised effective
            date. Continued use of the Services after changes are posted
            constitutes acceptance of those changes.
          </p>
        </>
      ),
    },
    {
      number: "11",
      title: "Privacy",
      content: (
        <p>
          Your privacy is important to us. At Capturing Story Gems (CSG), we do
          not sell nor share your personal information to third parties. We take
          reasonable measures to protect your data and only share information
          when necessary to deliver requested services or as required by law.
          Your stories belong to you. Our goal is to help you preserve, organize,
          and share them in ways you choose. Please review our{" "}
          <Link
            href="/privacy-policy"
            className="text-[#457B9D] font-semibold hover:underline"
          >
            Privacy Policy
          </Link>{" "}
          for more details.
        </p>
      ),
    },
    {
      number: "12",
      title: "Contact Us",
      content: (
        <>
          <p className="mb-4">
            If you have questions regarding these Terms or any CSG Services,
            please contact us:
          </p>
          <p className="mb-1 font-semibold">Capturing Story Gems</p>
          <a
            href="mailto:storygems.support@gmail.com"
            className="text-[#457B9D] font-semibold hover:underline"
          >
            storygems.support@gmail.com
          </a>
        </>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAF9F6] to-[#F5F5F0]">
      {/* Hero Section */}
      <div className="relative w-full py-20 md:py-32 bg-gradient-to-r from-[#457B9D] to-[#375E73]">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-32 h-32 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 right-10 w-40 h-40 bg-white rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 text-white text-center px-5 md:px-15">
          <div className="flex justify-center mb-6">
            <Image
              src="/leaf-1.svg"
              width={60}
              height={60}
              alt="leaf decoration"
            />
          </div>
          <h1 className="text-5xl md:text-7xl font-[Cormorant_Garamond] font-bold mb-4">
            Terms of Service
          </h1>
          <p className="text-lg md:text-xl max-w-3xl mx-auto opacity-95">
            Capturing Story Gems (CSG)
          </p>
          <p className="text-sm md:text-base mt-2 opacity-80">
            Effective Date: January 1, 2026
          </p>
        </div>
      </div>

      {/* Intro Section */}
      <div className="max-w-5xl mx-auto px-5 md:px-10 py-15">
        <div className="bg-white rounded-2xl shadow-lg p-8 md:p-10 border-l-4 border-[#457B9D] mb-15">
          <p className="text-lg text-gray-700 leading-relaxed mb-4">
            Welcome to Capturing Story Gems (&quot;CSG,&quot; &quot;we,&quot;
            &quot;our,&quot; or &quot;us&quot;). These Terms of Service
            (&quot;Terms&quot;) govern your use of the Capturing Story Gems
            website, programs, courses, tools, storybook services, and related
            offerings (collectively, the &quot;Services&quot;).
          </p>
          <p className="text-lg text-gray-700 leading-relaxed mb-4">
            Our mission is to help people discover, capture, preserve, and share
            meaningful memories and stories. To create a positive experience for
            everyone, we ask that you review and agree to the following Terms
            before using our Services.
          </p>
          <p className="text-lg text-gray-700 leading-relaxed">
            By accessing or using any part of our website or Services, you agree
            to these Terms and our{" "}
            <Link
              href="/privacy-policy"
              className="text-[#457B9D] font-semibold hover:underline"
            >
              Privacy Policy
            </Link>
            . If you do not agree, please do not use our Services.
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-10">
          {sections.map((section, index) => (
            <div
              key={index}
              className="bg-white rounded-2xl shadow-lg p-8 md:p-10 hover:shadow-xl transition-shadow duration-300"
            >
              <div className="flex items-start gap-4 mb-6">
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-[#457B9D] to-[#375E73] text-white rounded-full flex items-center justify-center font-bold text-xl">
                  {section.number}
                </div>
                <h2 className="text-3xl font-[Cormorant_Garamond] font-bold text-gray-800 pt-2">
                  {section.title}
                </h2>
              </div>
              <div className="text-gray-700 leading-relaxed pl-0 md:pl-16">
                {section.content}
              </div>
            </div>
          ))}

          {/* Our Commitment */}
          <div className="bg-gradient-to-r from-[#457B9D]/10 to-[#375E73]/10 rounded-2xl shadow-lg p-8 md:p-10 border border-[#457B9D]/20">
            <h2 className="text-3xl font-[Cormorant_Garamond] font-bold text-gray-800 mb-4">
              Our Commitment
            </h2>
            <p className="text-gray-700 leading-relaxed">
              Capturing Story Gems exists to help people preserve meaningful
              memories, create lasting stories, and share treasures that can be
              enjoyed by family, friends, and future generations. We are honored
              to be part of that journey.
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
