# Ryans notes on schema

## Overall
* Lets note that the API and db field names should be the same.. Lets be sure to ensure that we are aligned on the schema and field names between those two and the plan to do that is in SCHEMA-IMPLEMENTATION-PLAN.md
* If there any special conditions where we would serialize the value differently than it is stored. For example see ADR0019 about how to store and retrieve curerntcy and rate values 
* Create columns for the schema tables
  * display name
    * this is the publically facing name of the field - what is used in the Bravo Web UI and other systems. Note that we may sometimes have longer field names on the back end in order to disambiguate them or to build some consist field naming pattern - but the overall goal should be to align the display name (what non technical people call the fields) and what the fields are named
  * special notes - for instance if there are any special rule like ADR0019 that we are using here
  * For campaign in all fields
    * the field name should just be called price, not totalPrice
    * and the field should be named netRevenue, not totalNetRevenue
    * totalMediaBudget should be mediaBudget
* I really like the calculationVersion value this is really smart
* We have internally been differentiating between `Campaign` which is the business level campaign and has data that is sourced from Zoho CRM and zoho remains the source of truth, from `MediaStrategy` which are (a) the fields that are tied to the campaign but "owned" by Bravo (i.e. Bravo is the source of truth and the Bravo user can be the source of read/write for this) (b) the set of line items for the campaign. This is a 1:1 relationship but it becomes an easy way to refer to the different fields (i.e. when we made the dates and price editable and owned by Bravo we said we were moving those into the media strategy) and also helps to describe who works on what - i.e. the people work on the campaing in Zoho but on the Media Strategy in Bravo. I know it seems odd to have a separate object named in a 1:1 relationship but we have found it convenient can we use this in the schema?
  * How would you recommend doing this? The strategy ID would be the ID for this object? We could make the strategy ID the mongo ID or primary key of the campaign object if we want, but it would be nice to be able to refer to the fields as being part of the media strategy or part of the campaign separately and if that can be reflected in the schema 


## Account

* 

## Campaign

* initialAccountMarkupRate should be called initialAgencyMarkupRate
* initialAccountCommissionRate should be called initialReferralRate

There also shouldn't be a field called gross revenue. 

## Line Item
* should mediaBudget be a baseField? All line items will need to have a mediabudget

## Forward looking metrics
* Note that the forward looking metrics should be calculated and stored on the objects that it belongs to i.e. there should be a field in line items for estimatedUnits.. This is just another field. In the standard line item case, the calculations should calculate estimatedUnits from the price and unit price. But for other line item types the user may enter the estimatedUnits. So we need the flexiblity to do both

## Backward looking metrics 
* these look mostly look correct to start with - note that the core or base backward looking metrics will be the actualUnitsDelivered and actualMediaSpend.. These are typically gathered daily and we will want to be able to accumulate these daily amounts and all of the rest of the performance metrics (like pacing) compare the plan (forward metrics) to actuals (backward metrics). For example we will want to look at the cumulative amount for the campaign, to be able to filter to certain date ranges, and also to be able to aggregate by day (for instance for plotting time series)
* to keep with conventions, lets call mediaCostPerUnit `actualMediaCostPerUnit`
* Note that pacing metrics (delivery and spend) are indexed at 100% (when you are perfectly on-pace). The confluence ID of the page that descrtibes this is 387678209 you must review this and understand how pacing and progress metrics are meant to be calcualted and include those in the metrics
* Also note that all performance metrics should use netRevenue instead of privce when calculating thigns like revenue recognized and other metrics. For non-referral campaigns then price==net-revenue but for referral campaigns the price is the gross price and the net revenue is the price less the agency commission - note that we will not use the term GrossPrice anywhere though in the fields or in the application

## New Types
* Note that there is another type that is called a `PacingSchedule` 
* A pacing schedule belongs to a line item.. It indicates at what pace the campaign should be delivered.
*  the pacing schedule should have a number of `BudgetBlocks` where each Budget Block contains
  * Interval - the time rand for which to spend/deliver the budget
    * start date
    * end date
  * price - the amount (contract price) that needs to be spend in that time range
  * units - the numnber of units that need to be delivered
  * Note that currently units will be calculated from price, so that is another business logic calculation
  * the first version of this will implement the business logic such that it dervies the units from the price and the line items unit price
  * Note that these **SHOULD** be in the postgres database export that we created.. If you dont find it let me know..

  # Q&A from Calude

  Questions about your schema design:

  1. Campaign/MediaStrategy Separation

  You mentioned keeping Campaign and MediaStrategy as separate
  concepts in a 1:1 relationship. A few clarifications:
  - Should we have separate MongoDB collections for Campaign and
  MediaStrategy, or model them as nested objects within a single
  document? 

  a) Use the MediaStrategy's _id as the document ID in MongoDB
 stated above, do we need to have a separate mediastrategy _id?
  b) Keep Campaign _id but have a separate strategyId field

  c) Use subdocuments with Campaign containing MediaStrategy?

  [RR] Option c sounds correct to me

  - Which fields specifically belong to Campaign (Zoho-owned) vs
  MediaStrategy (Bravo-owned)?
  * [RR] The campaign name belongs to zoho and the relationship to account
  * [RR] Both the campaign and media strategy will have a date range (start and end date) the media strategy price and dates can change independantly of the campaign
  * [RR] There will be the referral commission fields in campaign (zoho) and also the agency markup at the campaign level
    * [RR] But there will also be a referralCommissionRate and agencyMarkupRate that beling to the MediaStrategy (Bravo) similar to the date range and price above


  2. Display Names and Field Naming

  You want a "display name" column in the schema tables. Should I:
  - Add this as a third column to all the field reference tables? [RR] yes
  - Include any specific display name conventions (e.g., "Net
  Revenue" vs "netRevenue")? [RR] yes these should be designed to be human readable
  - Document any cases where display names differ significantly
  from field names? [RR] yes

  3. PacingSchedule and BudgetBlocks

  Regarding the new PacingSchedule type:
  - Is this a 1:1 or 1:many relationship with LineItem? [RR] 1:1
  - Should BudgetBlocks be stored as an array within
  PacingSchedule? [RR] yes
  - You mentioned these should be in the PostgreSQL export - should
   I check the data files to see the actual structure? [RR] yes
  - For the price/units calculation in BudgetBlocks - is this using
   the line item's unitPrice? [RR] yes
   [RR] Other items to know about this
   * For validation logic, there should be a warning when the price of the budget blocks dont sum to the price of the line item, same with the units the sum of the budget block units are expected to sum to the esimtaedUnits for the line item
   * Also for our implementation there should be a pacing plan for every line item. even if it is just a single budget block that specifies to allocate the entire line item from the start to end date of the line item. Thats OK. 

  4. Terminology Updates

  Just to confirm these naming changes:
  - initialAccountMarkupRate → initialAgencyMarkupRate [RR] yes
  - initialAccountCommissionRate → initialReferralRate [RR] yes
  - Remove any "gross revenue" terminology [RR] yes
  - Use actualMediaCostPerUnit instead of mediaCostPerUnit [RR] yes

  5. Pacing Metrics at 100%

  You mentioned pacing metrics should be indexed at 100% (1.0 = on
  pace). Should I:
  - Store them as decimals (1.0 = 100%) or percentages (100 =
  100%)?
  - Update the calculation examples to show this clearly?
  - Review Confluence page 387678209 for the exact formulas?
  [RR] I believe that the pacing metrics might be calculated at query time, would that make more sense. Did you review the confluence page yet? Also for data format see ADR0019 in clnfluence at confliuence ID: 338198545

  6. Line Item Media Budget

  You asked if mediaBudget should be a base field for all line
  items. Given that:
  - Management fee line items have client-provided media budget
  - Zero dollar line items have Brkthru-paid media budget
  - Standard/zero margin calculate it from price
  Should this be in the base schema with different
  calculation/input rules per type?
  [RR] Yes there would be different input rules per type.. Some types would allow the user to edit things like Media buget and others might caluclate them from price, but some may use different calculations

  7. Forward Metrics Storage

  You emphasized that forward metrics should be stored directly on
  their objects (e.g., estimatedUnits on line items). Should I:
  - Move all forward metrics from a separate section to be fields
  on their respective entities?
  - Document which are calculated vs user-input for each line item
  type?
  [RR] Yes for a similar reason as above, some of these forward metrics might be input and others might be calculated. We will want to be able to alter the business logic and also to verify that the values are connrect from the data that is stored