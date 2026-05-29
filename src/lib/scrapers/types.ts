export interface EventItem {
  source: string;
  externalId: string;
  title: string;
  description?: string;
  link: string;
  startsAt: Date;
  endsAt?: Date;
  isOnline: boolean;
  venueName?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  imageUrl?: string;
  tags?: string[];
  groupName?: string;
  groupExternalId?: string;
}

export interface JobItem {
  source: string;
  externalId: string;
  title: string;
  description?: string;
  link: string;
  company: string;
  location?: string;
  remote: boolean;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  postedAt?: Date;
  tags?: string[];
}

export type AdapterRuntime = "fetch" | "browser";

export interface AdapterConfig {
  url: string;
  maxItems?: number;
}

export interface Adapter<T> {
  name: string;
  runtime: AdapterRuntime;
  scrape(config: AdapterConfig): Promise<T[]>;
}
