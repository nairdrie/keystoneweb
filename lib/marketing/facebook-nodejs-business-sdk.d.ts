declare module 'facebook-nodejs-business-sdk' {
  export const FacebookAdsApi: { init(token: string): void };
  export class AdAccount {
    constructor(id: string);
    createCampaign(fields: any[], params: any): Promise<any>;
    createAdSet(fields: any[], params: any): Promise<any>;
    createAdCreative(fields: any[], params: any): Promise<any>;
    createAd(fields: any[], params: any): Promise<any>;
  }
  export class Campaign {
    static Status: { active: string; paused: string };
    constructor(id: string);
    update(fields: any[], params: any): Promise<any>;
    getInsights(fields: string[], params: any): Promise<any[]>;
  }
}
