import React from 'react';
import { cn } from '@/lib/utils';
import type { CVPreviewData, TemplateStyle } from '@/lib/cv-export-types';

interface CVTemplatePreviewProps {
  data: CVPreviewData;
  style: TemplateStyle;
}

export function CVTemplatePreview({ data, style }: CVTemplatePreviewProps) {
  const { candidate, executiveSummary, branding, jobSpec } = data;
  const primaryColor = branding?.primary_color || '#2563eb';

  // Template-specific styles
  const getHeaderStyle = () => {
    switch (style) {
      case 'modern':
        return 'bg-gradient-to-r from-slate-900 to-slate-700 text-white p-6';
      case 'compact':
        return 'border-b-2 pb-3 mb-3';
      default: // classic
        return 'border-b-4 pb-4 mb-4';
    }
  };

  const getSectionStyle = () => {
    switch (style) {
      case 'modern':
        return 'mb-4';
      case 'compact':
        return 'mb-2';
      default:
        return 'mb-6';
    }
  };

  return (
    <div 
      className="p-4 text-[8px] leading-tight overflow-hidden" 
      style={{ 
        maxHeight: '400px',
        fontFamily: style === 'modern' ? 'system-ui' : 'Georgia, serif',
      }}
    >
      {/* Header */}
      <div 
        className={cn(getHeaderStyle())}
        style={{ 
          borderColor: style !== 'modern' ? primaryColor : undefined 
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h1 
              className={cn(
                'font-bold',
                style === 'modern' ? 'text-lg' : 'text-base',
                style === 'compact' && 'text-sm'
              )}
              style={{ color: style !== 'modern' ? primaryColor : undefined }}
            >
              {candidate.name}
            </h1>
            <p className={cn(
              'mt-0.5',
              style === 'modern' ? 'text-slate-300' : 'text-gray-600'
            )}>
              {candidate.currentTitle}
            </p>
          </div>
          {branding?.logo_path && (
            <img 
              src={branding.logo_path} 
              alt="Logo" 
              className="h-6 w-auto opacity-80"
            />
          )}
        </div>

        {/* Contact Info */}
        <div className={cn(
          'flex gap-3 mt-2 text-[7px]',
          style === 'modern' ? 'text-slate-400' : 'text-gray-500'
        )}>
          {candidate.email && <span>{candidate.email}</span>}
          {candidate.phone && <span>{candidate.phone}</span>}
          {candidate.location && <span>{candidate.location}</span>}
        </div>
      </div>

      {/* Executive Summary */}
      {executiveSummary && (
        <div className={getSectionStyle()}>
          <h2 
            className="font-bold mb-1 uppercase tracking-wide text-[7px]"
            style={{ color: primaryColor }}
          >
            Executive Summary
          </h2>
          <p className="text-gray-700 leading-relaxed">
            {executiveSummary.slice(0, 300)}
            {executiveSummary.length > 300 && '...'}
          </p>
        </div>
      )}

      {/* Job Spec Alignment Note */}
      {jobSpec && (
        <div 
          className="p-2 rounded mb-3 text-[6px]"
          style={{ backgroundColor: `${primaryColor}10` }}
        >
          <span className="font-medium">Prepared for: </span>
          {jobSpec.title}
        </div>
      )}

      {/* Skills */}
      {candidate.skills.length > 0 && (
        <div className={getSectionStyle()}>
          <h2 
            className="font-bold mb-1 uppercase tracking-wide text-[7px]"
            style={{ color: primaryColor }}
          >
            Core Skills
          </h2>
          <div className="flex flex-wrap gap-1">
            {candidate.skills.slice(0, style === 'compact' ? 8 : 12).map((skill, i) => (
              <span 
                key={i}
                className={cn(
                  'px-1.5 py-0.5 rounded text-[6px]',
                  style === 'modern' 
                    ? 'bg-slate-100 text-slate-700'
                    : 'border'
                )}
              >
                {skill}
              </span>
            ))}
            {candidate.skills.length > (style === 'compact' ? 8 : 12) && (
              <span className="text-gray-400">
                +{candidate.skills.length - (style === 'compact' ? 8 : 12)} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Experience Preview */}
      {candidate.experience.length > 0 && (
        <div className={getSectionStyle()}>
          <h2 
            className="font-bold mb-1 uppercase tracking-wide text-[7px]"
            style={{ color: primaryColor }}
          >
            Professional Experience
          </h2>
          <div className="space-y-2">
            {candidate.experience.slice(0, style === 'compact' ? 2 : 3).map((exp, i) => (
              <div key={i} className="border-l-2 pl-2" style={{ borderColor: primaryColor }}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold">{exp.title}</div>
                    <div className="text-gray-600">{exp.company}</div>
                  </div>
                  <div className="text-gray-400 text-[6px]">
                    {exp.startDate} - {exp.current ? 'Present' : exp.endDate}
                  </div>
                </div>
                {exp.description && style !== 'compact' && (
                  <p className="text-gray-600 mt-0.5">
                    {exp.description.slice(0, 100)}...
                  </p>
                )}
              </div>
            ))}
            {candidate.experience.length > (style === 'compact' ? 2 : 3) && (
              <p className="text-gray-400 text-center">
                + {candidate.experience.length - (style === 'compact' ? 2 : 3)} more roles
              </p>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 pt-2 border-t text-[6px] text-gray-400 text-center">
        Generated by {branding?.company_name || 'CV Export'} • Page 1 of 4 max
      </div>
    </div>
  );
}
