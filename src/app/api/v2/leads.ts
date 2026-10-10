'use server'

interface SearchOpts {
	location ?: string;
	industry ?: string;
	jobTitle?: string;
	company?: string | number;
	activeSince?: number;
	keywords?: string;
}

export const searchLeads = async (searchOpts: any) => {};
export const getSearchPrefs = async () => { };
export const enrichLead = async (leadId: string) => { };
export const createCollection = async (leads: string[]) => { };
