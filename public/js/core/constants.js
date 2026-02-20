// Apex Scout Manager — Core Constants

export const API_BASE_URL = '/api';
export const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5 MB

export const PRIVILEGE_DEFINITIONS = [
    { code: 'view_roster',            name: 'View troop roster',          category: 'Troop & Member Management' },
    { code: 'manage_members',         name: 'Manage troop members',       category: 'Troop & Member Management' },
    { code: 'manage_troop_settings',  name: 'Manage troop settings',      category: 'Troop & Member Management' },
    { code: 'send_invitations',       name: 'Send invitations',           category: 'Troop & Member Management' },
    { code: 'import_roster',          name: 'Import roster',              category: 'Troop & Member Management' },
    { code: 'manage_member_roles',    name: 'Manage member roles',        category: 'Troop & Member Management' },
    { code: 'manage_privileges',      name: 'Manage privileges',          category: 'Troop & Member Management' },
    { code: 'view_scout_profiles',    name: 'View scout profiles',        category: 'Scout Profiles & Advancement' },
    { code: 'edit_scout_level',       name: 'Edit scout level',           category: 'Scout Profiles & Advancement' },
    { code: 'edit_scout_status',      name: 'Edit scout status',          category: 'Scout Profiles & Advancement' },
    { code: 'award_badges',           name: 'Award badges',               category: 'Scout Profiles & Advancement' },
    { code: 'view_badge_progress',    name: 'View badge progress',        category: 'Scout Profiles & Advancement' },
    { code: 'edit_personal_info',     name: 'Edit personal info',         category: 'Scout Profiles & Advancement' },
    { code: 'view_events',            name: 'View events',                category: 'Calendar & Events' },
    { code: 'manage_events',          name: 'Manage events',              category: 'Calendar & Events' },
    { code: 'export_calendar',        name: 'Export calendar',            category: 'Calendar & Events' },
    { code: 'view_sales',             name: 'View sales data',            category: 'Fundraising & Sales' },
    { code: 'record_sales',           name: 'Record sales',               category: 'Fundraising & Sales' },
    { code: 'manage_fundraisers',     name: 'Manage fundraisers',         category: 'Fundraising & Sales' },
    { code: 'view_troop_sales',       name: 'View troop sales',           category: 'Fundraising & Sales' },
    { code: 'view_financials',        name: 'View financial accounts',    category: 'Fundraising & Sales' },
    { code: 'manage_financials',      name: 'Manage financial accounts',  category: 'Fundraising & Sales' },
    { code: 'view_donations',         name: 'View donations',             category: 'Donations' },
    { code: 'record_donations',       name: 'Record donations',           category: 'Donations' },
    { code: 'delete_donations',       name: 'Delete donations',           category: 'Donations' },
    { code: 'view_goals',             name: 'View goals',                 category: 'Troop Goals & Reporting' },
    { code: 'manage_goals',           name: 'Manage goals',               category: 'Troop Goals & Reporting' },
    { code: 'view_leaderboard',       name: 'View leaderboard',           category: 'Troop Goals & Reporting' },
    { code: 'manage_payment_methods', name: 'Manage payment methods',     category: 'Data & Settings' },
    { code: 'import_data',            name: 'Import data',                category: 'Data & Settings' },
    { code: 'export_data',            name: 'Export data',                category: 'Data & Settings' },
    { code: 'delete_own_data',        name: 'Delete own data',            category: 'Data & Settings' },
];

export const ROLE_PRIVILEGE_DEFAULTS = {
    member:         { view_roster:'none', manage_members:'none', manage_troop_settings:'none', send_invitations:'none', import_roster:'none', manage_member_roles:'none', manage_privileges:'none', view_scout_profiles:'S', edit_scout_level:'none', edit_scout_status:'none', award_badges:'none', view_badge_progress:'S', edit_personal_info:'none', view_events:'T', manage_events:'none', export_calendar:'T', view_sales:'S', record_sales:'S', manage_fundraisers:'none', view_troop_sales:'none', view_financials:'none', manage_financials:'none', view_donations:'S', record_donations:'S', delete_donations:'S', view_goals:'T', manage_goals:'none', view_leaderboard:'T', manage_payment_methods:'S', import_data:'none', export_data:'S', delete_own_data:'S' },
    parent:         { view_roster:'none', manage_members:'none', manage_troop_settings:'none', send_invitations:'none', import_roster:'none', manage_member_roles:'none', manage_privileges:'none', view_scout_profiles:'H', edit_scout_level:'none', edit_scout_status:'none', award_badges:'none', view_badge_progress:'H', edit_personal_info:'H', view_events:'T', manage_events:'none', export_calendar:'T', view_sales:'H', record_sales:'H', manage_fundraisers:'none', view_troop_sales:'none', view_financials:'none', manage_financials:'none', view_donations:'H', record_donations:'H', delete_donations:'H', view_goals:'T', manage_goals:'none', view_leaderboard:'T', manage_payment_methods:'S', import_data:'none', export_data:'H', delete_own_data:'S' },
    volunteer:      { view_roster:'T', manage_members:'none', manage_troop_settings:'none', send_invitations:'none', import_roster:'none', manage_member_roles:'none', manage_privileges:'none', view_scout_profiles:'none', edit_scout_level:'none', edit_scout_status:'none', award_badges:'none', view_badge_progress:'none', edit_personal_info:'none', view_events:'T', manage_events:'none', export_calendar:'T', view_sales:'none', record_sales:'none', manage_fundraisers:'none', view_troop_sales:'none', view_financials:'none', manage_financials:'none', view_donations:'none', record_donations:'none', delete_donations:'none', view_goals:'T', manage_goals:'none', view_leaderboard:'T', manage_payment_methods:'S', import_data:'none', export_data:'none', delete_own_data:'S' },
    assistant:      { view_roster:'T', manage_members:'none', manage_troop_settings:'none', send_invitations:'none', import_roster:'none', manage_member_roles:'none', manage_privileges:'none', view_scout_profiles:'D', edit_scout_level:'none', edit_scout_status:'none', award_badges:'none', view_badge_progress:'D', edit_personal_info:'none', view_events:'T', manage_events:'T', export_calendar:'T', view_sales:'none', record_sales:'none', manage_fundraisers:'none', view_troop_sales:'none', view_financials:'none', manage_financials:'none', view_donations:'none', record_donations:'none', delete_donations:'none', view_goals:'T', manage_goals:'none', view_leaderboard:'T', manage_payment_methods:'S', import_data:'none', export_data:'none', delete_own_data:'S' },
    'co-leader':    { view_roster:'T', manage_members:'T', manage_troop_settings:'T', send_invitations:'T', import_roster:'T', manage_member_roles:'none', manage_privileges:'none', view_scout_profiles:'T', edit_scout_level:'T', edit_scout_status:'T', award_badges:'T', view_badge_progress:'T', edit_personal_info:'T', view_events:'T', manage_events:'T', export_calendar:'T', view_sales:'T', record_sales:'S', manage_fundraisers:'T', view_troop_sales:'T', view_financials:'T', manage_financials:'none', view_donations:'T', record_donations:'S', delete_donations:'S', view_goals:'T', manage_goals:'T', view_leaderboard:'T', manage_payment_methods:'S', import_data:'none', export_data:'T', delete_own_data:'S' },
    cookie_leader:  { view_roster:'T', manage_members:'none', manage_troop_settings:'none', send_invitations:'none', import_roster:'none', manage_member_roles:'none', manage_privileges:'none', view_scout_profiles:'none', edit_scout_level:'none', edit_scout_status:'none', award_badges:'none', view_badge_progress:'none', edit_personal_info:'none', view_events:'T', manage_events:'none', export_calendar:'T', view_sales:'T', record_sales:'T', manage_fundraisers:'T', view_troop_sales:'T', view_financials:'T', manage_financials:'T', view_donations:'T', record_donations:'S', delete_donations:'none', view_goals:'T', manage_goals:'none', view_leaderboard:'T', manage_payment_methods:'S', import_data:'T', export_data:'T', delete_own_data:'S' },
    troop_leader:   { view_roster:'T', manage_members:'T', manage_troop_settings:'T', send_invitations:'T', import_roster:'T', manage_member_roles:'T', manage_privileges:'T', view_scout_profiles:'T', edit_scout_level:'T', edit_scout_status:'T', award_badges:'T', view_badge_progress:'T', edit_personal_info:'T', view_events:'T', manage_events:'T', export_calendar:'T', view_sales:'T', record_sales:'T', manage_fundraisers:'T', view_troop_sales:'T', view_financials:'T', manage_financials:'T', view_donations:'T', record_donations:'T', delete_donations:'T', view_goals:'T', manage_goals:'T', view_leaderboard:'T', manage_payment_methods:'S', import_data:'T', export_data:'T', delete_own_data:'S' },
    admin:          { view_roster:'T', manage_members:'T', manage_troop_settings:'T', send_invitations:'T', import_roster:'T', manage_member_roles:'T', manage_privileges:'T', view_scout_profiles:'T', edit_scout_level:'T', edit_scout_status:'T', award_badges:'T', view_badge_progress:'T', edit_personal_info:'T', view_events:'T', manage_events:'T', export_calendar:'T', view_sales:'T', record_sales:'T', manage_fundraisers:'T', view_troop_sales:'T', view_financials:'T', manage_financials:'T', view_donations:'T', record_donations:'T', delete_donations:'T', view_goals:'T', manage_goals:'T', view_leaderboard:'T', manage_payment_methods:'S', import_data:'T', export_data:'T', delete_own_data:'S' },
    cookie_manager: { view_roster:'T', manage_members:'none', manage_troop_settings:'none', send_invitations:'none', import_roster:'none', manage_member_roles:'none', manage_privileges:'none', view_scout_profiles:'T', edit_scout_level:'none', edit_scout_status:'none', award_badges:'none', view_badge_progress:'T', edit_personal_info:'none', view_events:'T', manage_events:'none', export_calendar:'T', view_sales:'T', record_sales:'T', manage_fundraisers:'T', view_troop_sales:'T', view_financials:'T', manage_financials:'T', view_donations:'T', record_donations:'T', delete_donations:'none', view_goals:'T', manage_goals:'T', view_leaderboard:'T', manage_payment_methods:'S', import_data:'T', export_data:'T', delete_own_data:'S' },
};

export const SCOPE_ORDER = ['T', 'D', 'H', 'S', 'none'];
export const SCOPE_LABELS = { T: 'Troop', D: 'Den/Patrol', H: 'Household', S: 'Self', none: 'None' };
