import React from 'react';

interface OfferDetails {
    acceptanceDate?: string;
    closingDate?: string;
    inspectionPeriod?: string;
    appraisalPeriod?: string;
    financingDeadline?: string;
    propertyAddress?: string;
    buyerName?: string;
    sellerName?: string;
    salePrice?: string;
}
type TimelineItem = {
    task: string;
    date: Date;
    priority?: 'critical' | 'high' | 'medium' | 'low';
    responsible?: string;
    agentAction?: boolean;
};
type EmailTemplate = {
    title: string;
    subject: string;
    body: string;
};
interface RealEstateAgentProps {
    initialOfferDetails?: Partial<OfferDetails>;
    onGenerate?: (timeline: TimelineItem[], emailTemplates: EmailTemplate[]) => void;
    className?: string;
}
declare const RealEstateAgent: React.FC<RealEstateAgentProps>;

export { EmailTemplate, OfferDetails, RealEstateAgent, RealEstateAgentProps, TimelineItem };
