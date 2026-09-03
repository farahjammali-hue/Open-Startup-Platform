import type { DocumentCategory } from "./documentCategories";

export interface ChecklistItem {
  /** Stable slug — links an uploaded document back to this exact checklist row. */
  key: string;
  title: string;
  /** "What is this?" — a plain-language definition of the document. */
  whatIsThis: string;
  /** "Where they should be" — who owns it or where to find it inside the company. */
  whereToFind: string;
  optional?: boolean;
}

export interface ChecklistCategory {
  category: DocumentCategory;
  label: string;
  items: ChecklistItem[];
}

/**
 * The Data Room submission checklist — categories, documents, definitions, and
 * sourcing guidance, from the OST GROW 3.0 Data Room Checklist.
 */
export const DATA_ROOM_CHECKLIST: ChecklistCategory[] = [
  {
    category: "main_docs",
    label: "Main Docs & Summary",
    items: [
      {
        key: "pitch_deck",
        title: "Pitch Deck",
        whatIsThis: "A pitch deck is a 12-15 slide summary of your company: from the problem you are solving to your product, business model, growth strategy, traction, and competitive advantages.",
        whereToFind: "Your pitch deck should be a slide deck presentation. It could be a PPT, Keynote, Google Slides, or any other presentation format. It can also be a static PDF, or it can also be shared online.",
      },
      {
        key: "one_pager",
        title: "One Pager",
        whatIsThis: "A one-pager is an executive summary of your company's value proposition and business model.",
        whereToFind: "Not tracked separately — usually created alongside your pitch deck, by whoever built that.",
      },
    ],
  },
  {
    category: "financial",
    label: "Financials",
    items: [
      {
        key: "profit_and_loss",
        title: "Profit and loss statements",
        whatIsThis: "A common accounting document that lays out expenses over a given period of time.",
        whereToFind: "In your accounting software. If you don't have direct access to it, you can ask your bookkeepers for it.",
      },
      {
        key: "balance_sheet",
        title: "Balance Sheet",
        whatIsThis: "A common accounting document that lays out assets the company currently owns.",
        whereToFind: "In your accounting software. If you don't have direct access to it, you can ask your bookkeepers for it.",
      },
      {
        key: "financial_model",
        title: "Financial Model",
        whatIsThis: "A spreadsheet that lets you budget your future expenses and run revenue estimation.",
        whereToFind: "Your ops team should work out your financial model weekly to estimate future expenses, revenue, and company runway.",
      },
    ],
  },
  {
    category: "legal",
    label: "Legal",
    items: [
      {
        key: "articles_of_incorporation",
        title: "Articles of incorporation, and any amendments to them",
        whatIsThis: "A 2-3 page document certifying the company is incorporated.",
        whereToFind: "They should have been provided by the law firm that incorporated your business.",
      },
      {
        key: "voting_agreements_bylaws",
        title: "Voting agreements / Company Bylaws",
        whatIsThis: "A document describing how voting and distribution works — that decisions require executive vs. board vs. shareholder approval — and essentially all shareholder rules.",
        whereToFind: "They should have been provided by the law firm that incorporated your business.",
      },
      {
        key: "stock_purchase_agreements",
        title: "Stock purchase agreements",
        whatIsThis: "A document describing how many shares were 'sold' to individuals or entities at the time of incorporation.",
        whereToFind: "They should have been provided by the law firm that incorporated your business.",
      },
      {
        key: "capitalization_table",
        title: "Capitalization table",
        whatIsThis: "A table summarizing the current stock distribution for the company.",
        whereToFind: "The cap table is simply a summary of what has been agreed on in the Stock Purchase agreements and with other investments.",
      },
      {
        key: "board_profiles",
        title: "Board Profiles",
        whatIsThis: "A presentation summarizing the structure of the Board of Directors, the individuals involved, and their backgrounds.",
        whereToFind: "The company CEO or Secretary should keep track of them.",
      },
      {
        key: "board_consents_and_actions",
        title: "Board consents and actions",
        whatIsThis: "A board consent is an internal company document describing a policy, expense, or action that the Board agreed upon. They are normally signed by all Board Members.",
        whereToFind: "The company CEO or Secretary should keep track of them.",
      },
      {
        key: "board_meeting_minutes",
        title: "All board meeting minutes",
        whatIsThis: "A board minute is a transcript of the Board of Directors' discussion.",
        whereToFind: "The company CEO or Secretary should keep track of them.",
        optional: true,
      },
    ],
  },
  {
    category: "fundraising",
    label: "Previous Funding",
    items: [
      {
        key: "investor_rights_agreements",
        title: "Investor rights agreements",
        whatIsThis: "A common document laying out the investor's preferred stock (special qualities their shares have vs. common shares).",
        whereToFind: "They should be part of the documentation of your previous funding round.",
      },
      {
        key: "first_refusal_co_sale_agreements",
        title: "First refusal & co-sale agreements",
        whatIsThis: "Many investors will request special rights when the company makes relevant transactions such as exits and new funding rounds. This document lays out their specifications.",
        whereToFind: "They should be part of the documentation of your previous funding round.",
      },
      {
        key: "other_round_closing_documents",
        title: "Other round closing documents",
        whatIsThis: "Any other file or agreement signed as part of the funding round.",
        whereToFind: "They should be part of the documentation of your previous funding round.",
      },
    ],
  },
  {
    category: "intellectual_property",
    label: "Intellectual Property",
    items: [
      {
        key: "patents",
        title: "Granted and filed patents",
        whatIsThis: "If you have been granted patents on any of your inventions, they may be one of the company's most important assets. Provisional patents aren't really relevant until they are converted to an actual patent.",
        whereToFind: "The attorney that led the registration should have a copy.",
      },
      {
        key: "trademarks",
        title: "Trademarks",
        whatIsThis: "Registration of your brand name with the USPTO. It also confirms that you are allowed to use your brand name for your product.",
        whereToFind: "The attorney or service that registered your brand should be able to provide you with a copy. Otherwise, you can download a certificate from the USPTO Trademark Database.",
      },
      {
        key: "brand_book_design_guide",
        title: "Brand Book or Design Guide",
        whatIsThis: "A Brand Book describes how to use your brand across marketing materials. A Design Guide is similar but focuses more on visual and UI design specifics.",
        whereToFind: "Your marketing team, or your product team, should have one.",
        optional: true,
      },
    ],
  },
  {
    category: "team",
    label: "Staff",
    items: [
      {
        key: "org_chart",
        title: "Org Chart",
        whatIsThis: "A visual diagram showing the company structure.",
        whereToFind: "Not all companies have an updated Org Chart — it's fine to skip this one if yours doesn't.",
      },
      {
        key: "employee_list_titles_salaries",
        title: "List of all current employees, titles, and salaries",
        whatIsThis: "Investors will want to see a list of key employees and their salaries. While they don't usually want direct oversight over team compensation, it's pretty standard for them to confirm that compensation is reasonable.",
        whereToFind: "Companies usually keep track of their employees via their payroll software.",
      },
      {
        key: "contractors_list",
        title: "List of contract workers and firms",
        whatIsThis: "Since many early-stage companies choose to hire their team as contractors, investors will also want to see the list of ongoing contractors and their compensation.",
        whereToFind: "Companies usually keep track of their contractors via their financial model.",
      },
      {
        key: "employee_agreements",
        title: "Employee agreements",
        whatIsThis: "Investors want to check that you've done the due diligence of signing employee agreements with all hires, making sure IP is assigned to the company and confidentiality agreements are in place.",
        whereToFind: "Your ops team should keep these documents organized and secured.",
      },
    ],
  },
  {
    category: "metrics",
    label: "Metrics",
    items: [
      {
        key: "sales_pipeline",
        title: "Sales pipeline",
        whatIsThis: "A sales pipeline is a system that tracks potential sales opportunities as clients move through different stages of the buying process.",
        whereToFind: "Your sales team should build this based on your business lead stages.",
      },
      {
        key: "saas_metrics",
        title: "SaaS Metrics",
        whatIsThis: "SaaS metrics are a way to measure how well your software is performing.",
        whereToFind: "Team managers usually oversee these metrics and keep them updated.",
      },
      {
        key: "usage_metrics",
        title: "Usage Metrics",
        whatIsThis: "Usage metrics are a way to track how people are using your product/service. This information can help you improve your product.",
        whereToFind: "Team managers usually oversee these metrics and keep them updated. Depending on your stage, your product manager will own this task.",
      },
    ],
  },
  {
    category: "other",
    label: "Other",
    items: [
      {
        key: "system_architecture_diagram",
        title: "System architecture diagram",
        whatIsThis: "System architecture diagrams are used to show how a system is organized. They can include information on how the different parts of the system work together.",
        whereToFind: "Your CTO should build and keep this updated.",
        optional: true,
      },
      {
        key: "integrations_api_docs",
        title: "Details on any large integrations, and other API documentation",
        whatIsThis: "This is a page with information about big integrations and other API documentation.",
        whereToFind: "Your CTO should build and keep this updated.",
      },
    ],
  },
];

export const CHECKLIST_TOTAL_COUNT = DATA_ROOM_CHECKLIST.reduce((n, c) => n + c.items.length, 0);
