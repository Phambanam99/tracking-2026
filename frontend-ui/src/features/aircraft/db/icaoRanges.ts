export type IcaoCountryInfo = {
  countryCode: string;
  countryName: string;
  countryFlagUrl: string;
};

type CountryRange = {
  startHex: number;
  endHex: number;
  countryCode: string;
  countryName: string;
};

type IndexedCountryRange = CountryRange & {
  span: number;
  priority: number;
};

const FLAG_CDN_BASE_URL = "https://flagcdn.com/h80";

const COUNTRY_RANGES: CountryRange[] = [
  { startHex: 0x004000, endHex: 0x0047FF, countryCode: "zw", countryName: "Zimbabwe" },
  { startHex: 0x006000, endHex: 0x006FFF, countryCode: "mz", countryName: "Mozambique" },
  { startHex: 0x008000, endHex: 0x00FFFF, countryCode: "za", countryName: "South Africa" },
  { startHex: 0x010000, endHex: 0x017FFF, countryCode: "eg", countryName: "Egypt" },
  { startHex: 0x018000, endHex: 0x01FFFF, countryCode: "ly", countryName: "Libya" },
  { startHex: 0x020000, endHex: 0x027FFF, countryCode: "ma", countryName: "Morocco" },
  { startHex: 0x028000, endHex: 0x02FFFF, countryCode: "tn", countryName: "Tunisia" },
  { startHex: 0x030000, endHex: 0x0307FF, countryCode: "bw", countryName: "Botswana" },
  { startHex: 0x032000, endHex: 0x032FFF, countryCode: "bi", countryName: "Burundi" },
  { startHex: 0x034000, endHex: 0x034FFF, countryCode: "cm", countryName: "Cameroon" },
  { startHex: 0x035000, endHex: 0x0357FF, countryCode: "km", countryName: "Comoros" },
  { startHex: 0x036000, endHex: 0x036FFF, countryCode: "cg", countryName: "Republic of the Congo" },
  { startHex: 0x038000, endHex: 0x038FFF, countryCode: "ci", countryName: "Cote d'Ivoire" },
  { startHex: 0x03E000, endHex: 0x03EFFF, countryCode: "ga", countryName: "Gabon" },
  { startHex: 0x040000, endHex: 0x040FFF, countryCode: "et", countryName: "Ethiopia" },
  { startHex: 0x042000, endHex: 0x042FFF, countryCode: "gq", countryName: "Equatorial Guinea" },
  { startHex: 0x044000, endHex: 0x044FFF, countryCode: "gh", countryName: "Ghana" },
  { startHex: 0x046000, endHex: 0x046FFF, countryCode: "gn", countryName: "Guinea" },
  { startHex: 0x048000, endHex: 0x0487FF, countryCode: "gw", countryName: "Guinea-Bissau" },
  { startHex: 0x04A000, endHex: 0x04A7FF, countryCode: "ls", countryName: "Lesotho" },
  { startHex: 0x04C000, endHex: 0x04CFFF, countryCode: "ke", countryName: "Kenya" },
  { startHex: 0x050000, endHex: 0x050FFF, countryCode: "lr", countryName: "Liberia" },
  { startHex: 0x054000, endHex: 0x054FFF, countryCode: "mg", countryName: "Madagascar" },
  { startHex: 0x058000, endHex: 0x058FFF, countryCode: "mw", countryName: "Malawi" },
  { startHex: 0x05A000, endHex: 0x05A7FF, countryCode: "mv", countryName: "Maldives" },
  { startHex: 0x05C000, endHex: 0x05CFFF, countryCode: "ml", countryName: "Mali" },
  { startHex: 0x05E000, endHex: 0x05E7FF, countryCode: "mr", countryName: "Mauritania" },
  { startHex: 0x060000, endHex: 0x0607FF, countryCode: "mu", countryName: "Mauritius" },
  { startHex: 0x062000, endHex: 0x062FFF, countryCode: "ne", countryName: "Niger" },
  { startHex: 0x064000, endHex: 0x064FFF, countryCode: "ng", countryName: "Nigeria" },
  { startHex: 0x068000, endHex: 0x068FFF, countryCode: "ug", countryName: "Uganda" },
  { startHex: 0x06A000, endHex: 0x06AFFF, countryCode: "qa", countryName: "Qatar" },
  { startHex: 0x06C000, endHex: 0x06CFFF, countryCode: "cf", countryName: "Central African Republic" },
  { startHex: 0x06E000, endHex: 0x06EFFF, countryCode: "rw", countryName: "Rwanda" },
  { startHex: 0x070000, endHex: 0x070FFF, countryCode: "sn", countryName: "Senegal" },
  { startHex: 0x074000, endHex: 0x0747FF, countryCode: "sc", countryName: "Seychelles" },
  { startHex: 0x076000, endHex: 0x0767FF, countryCode: "sl", countryName: "Sierra Leone" },
  { startHex: 0x078000, endHex: 0x078FFF, countryCode: "so", countryName: "Somalia" },
  { startHex: 0x07A000, endHex: 0x07A7FF, countryCode: "sz", countryName: "Eswatini" },
  { startHex: 0x07C000, endHex: 0x07CFFF, countryCode: "sd", countryName: "Sudan" },
  { startHex: 0x080000, endHex: 0x080FFF, countryCode: "tz", countryName: "Tanzania" },
  { startHex: 0x084000, endHex: 0x084FFF, countryCode: "td", countryName: "Chad" },
  { startHex: 0x088000, endHex: 0x088FFF, countryCode: "tg", countryName: "Togo" },
  { startHex: 0x08A000, endHex: 0x08AFFF, countryCode: "zm", countryName: "Zambia" },
  { startHex: 0x08C000, endHex: 0x08CFFF, countryCode: "cd", countryName: "DR Congo" },
  { startHex: 0x090000, endHex: 0x090FFF, countryCode: "ao", countryName: "Angola" },
  { startHex: 0x094000, endHex: 0x0947FF, countryCode: "bj", countryName: "Benin" },
  { startHex: 0x096000, endHex: 0x0967FF, countryCode: "cv", countryName: "Cabo Verde" },
  { startHex: 0x098000, endHex: 0x0987FF, countryCode: "dj", countryName: "Djibouti" },
  { startHex: 0x09A000, endHex: 0x09AFFF, countryCode: "gm", countryName: "Gambia" },
  { startHex: 0x09C000, endHex: 0x09CFFF, countryCode: "bf", countryName: "Burkina Faso" },
  { startHex: 0x09E000, endHex: 0x09E7FF, countryCode: "st", countryName: "Sao Tome and Principe" },
  { startHex: 0x0A0000, endHex: 0x0A7FFF, countryCode: "dz", countryName: "Algeria" },
  { startHex: 0x0A8000, endHex: 0x0A8FFF, countryCode: "bs", countryName: "Bahamas" },
  { startHex: 0x0AA000, endHex: 0x0AA7FF, countryCode: "bb", countryName: "Barbados" },
  { startHex: 0x0AB000, endHex: 0x0AB7FF, countryCode: "bz", countryName: "Belize" },
  { startHex: 0x0AC000, endHex: 0x0ADFFF, countryCode: "co", countryName: "Colombia" },
  { startHex: 0x0AE000, endHex: 0x0AEFFF, countryCode: "cr", countryName: "Costa Rica" },
  { startHex: 0x0B0000, endHex: 0x0B0FFF, countryCode: "cu", countryName: "Cuba" },
  { startHex: 0x0B2000, endHex: 0x0B2FFF, countryCode: "sv", countryName: "El Salvador" },
  { startHex: 0x0B4000, endHex: 0x0B4FFF, countryCode: "gt", countryName: "Guatemala" },
  { startHex: 0x0B6000, endHex: 0x0B6FFF, countryCode: "gy", countryName: "Guyana" },
  { startHex: 0x0B8000, endHex: 0x0B8FFF, countryCode: "ht", countryName: "Haiti" },
  { startHex: 0x0BA000, endHex: 0x0BAFFF, countryCode: "hn", countryName: "Honduras" },
  { startHex: 0x0BC000, endHex: 0x0BC7FF, countryCode: "vc", countryName: "Saint Vincent and the Grenadines" },
  { startHex: 0x0BE000, endHex: 0x0BEFFF, countryCode: "jm", countryName: "Jamaica" },
  { startHex: 0x0C0000, endHex: 0x0C0FFF, countryCode: "ni", countryName: "Nicaragua" },
  { startHex: 0x0C2000, endHex: 0x0C2FFF, countryCode: "pa", countryName: "Panama" },
  { startHex: 0x0C4000, endHex: 0x0C4FFF, countryCode: "do", countryName: "Dominican Republic" },
  { startHex: 0x0C6000, endHex: 0x0C6FFF, countryCode: "tt", countryName: "Trinidad and Tobago" },
  { startHex: 0x0C8000, endHex: 0x0C8FFF, countryCode: "sr", countryName: "Suriname" },
  { startHex: 0x0CA000, endHex: 0x0CA7FF, countryCode: "ag", countryName: "Antigua and Barbuda" },
  { startHex: 0x0CC000, endHex: 0x0CC7FF, countryCode: "gd", countryName: "Grenada" },
  { startHex: 0x0D0000, endHex: 0x0D7FFF, countryCode: "mx", countryName: "Mexico" },
  { startHex: 0x0D8000, endHex: 0x0DFFFF, countryCode: "ve", countryName: "Venezuela" },
  { startHex: 0x100000, endHex: 0x1FFFFF, countryCode: "ru", countryName: "Russia" },
  { startHex: 0x201000, endHex: 0x2017FF, countryCode: "na", countryName: "Namibia" },
  { startHex: 0x202000, endHex: 0x2027FF, countryCode: "er", countryName: "Eritrea" },
  { startHex: 0x300000, endHex: 0x33FFFF, countryCode: "it", countryName: "Italy" },
  { startHex: 0x340000, endHex: 0x37FFFF, countryCode: "es", countryName: "Spain" },
  { startHex: 0x380000, endHex: 0x3BFFFF, countryCode: "fr", countryName: "France" },
  { startHex: 0x3C0000, endHex: 0x3FFFFF, countryCode: "de", countryName: "Germany" },
  { startHex: 0x400000, endHex: 0x4001BF, countryCode: "bm", countryName: "Bermuda" },
  { startHex: 0x4001C0, endHex: 0x4001FF, countryCode: "ky", countryName: "Cayman Islands" },
  { startHex: 0x400300, endHex: 0x4003FF, countryCode: "tc", countryName: "Turks and Caicos Islands" },
  { startHex: 0x424135, endHex: 0x4241F2, countryCode: "ky", countryName: "Cayman Islands" },
  { startHex: 0x424200, endHex: 0x4246FF, countryCode: "bm", countryName: "Bermuda" },
  { startHex: 0x424700, endHex: 0x424899, countryCode: "ky", countryName: "Cayman Islands" },
  { startHex: 0x424B00, endHex: 0x424BFF, countryCode: "im", countryName: "Isle of Man" },
  { startHex: 0x43BE00, endHex: 0x43BEFF, countryCode: "bm", countryName: "Bermuda" },
  { startHex: 0x43E700, endHex: 0x43EAFD, countryCode: "im", countryName: "Isle of Man" },
  { startHex: 0x43EAFE, endHex: 0x43EEFF, countryCode: "gg", countryName: "Guernsey" },
  { startHex: 0x400000, endHex: 0x43FFFF, countryCode: "gb", countryName: "United Kingdom" },
  { startHex: 0x440000, endHex: 0x447FFF, countryCode: "at", countryName: "Austria" },
  { startHex: 0x448000, endHex: 0x44FFFF, countryCode: "be", countryName: "Belgium" },
  { startHex: 0x450000, endHex: 0x457FFF, countryCode: "bg", countryName: "Bulgaria" },
  { startHex: 0x458000, endHex: 0x45FFFF, countryCode: "dk", countryName: "Denmark" },
  { startHex: 0x460000, endHex: 0x467FFF, countryCode: "fi", countryName: "Finland" },
  { startHex: 0x468000, endHex: 0x46FFFF, countryCode: "gr", countryName: "Greece" },
  { startHex: 0x470000, endHex: 0x477FFF, countryCode: "hu", countryName: "Hungary" },
  { startHex: 0x478000, endHex: 0x47FFFF, countryCode: "no", countryName: "Norway" },
  { startHex: 0x480000, endHex: 0x487FFF, countryCode: "nl", countryName: "Netherlands" },
  { startHex: 0x488000, endHex: 0x48FFFF, countryCode: "pl", countryName: "Poland" },
  { startHex: 0x490000, endHex: 0x497FFF, countryCode: "pt", countryName: "Portugal" },
  { startHex: 0x498000, endHex: 0x49FFFF, countryCode: "cz", countryName: "Czechia" },
  { startHex: 0x4A0000, endHex: 0x4A7FFF, countryCode: "ro", countryName: "Romania" },
  { startHex: 0x4A8000, endHex: 0x4AFFFF, countryCode: "se", countryName: "Sweden" },
  { startHex: 0x4B0000, endHex: 0x4B7FFF, countryCode: "ch", countryName: "Switzerland" },
  { startHex: 0x4B8000, endHex: 0x4BFFFF, countryCode: "tr", countryName: "Turkey" },
  { startHex: 0x4C0000, endHex: 0x4C7FFF, countryCode: "rs", countryName: "Serbia" },
  { startHex: 0x4C8000, endHex: 0x4C87FF, countryCode: "cy", countryName: "Cyprus" },
  { startHex: 0x4CA000, endHex: 0x4CAFFF, countryCode: "ie", countryName: "Ireland" },
  { startHex: 0x4CC000, endHex: 0x4CCFFF, countryCode: "is", countryName: "Iceland" },
  { startHex: 0x4D0000, endHex: 0x4D07FF, countryCode: "lu", countryName: "Luxembourg" },
  { startHex: 0x4D2000, endHex: 0x4D27FF, countryCode: "mt", countryName: "Malta" },
  { startHex: 0x4D4000, endHex: 0x4D47FF, countryCode: "mc", countryName: "Monaco" },
  { startHex: 0x500000, endHex: 0x5007FF, countryCode: "sm", countryName: "San Marino" },
  { startHex: 0x501000, endHex: 0x5017FF, countryCode: "al", countryName: "Albania" },
  { startHex: 0x501800, endHex: 0x501FFF, countryCode: "hr", countryName: "Croatia" },
  { startHex: 0x502800, endHex: 0x502FFF, countryCode: "lv", countryName: "Latvia" },
  { startHex: 0x503800, endHex: 0x503FFF, countryCode: "lt", countryName: "Lithuania" },
  { startHex: 0x504800, endHex: 0x504FFF, countryCode: "md", countryName: "Moldova" },
  { startHex: 0x505800, endHex: 0x505FFF, countryCode: "sk", countryName: "Slovakia" },
  { startHex: 0x506800, endHex: 0x506FFF, countryCode: "si", countryName: "Slovenia" },
  { startHex: 0x507800, endHex: 0x507FFF, countryCode: "uz", countryName: "Uzbekistan" },
  { startHex: 0x508000, endHex: 0x50FFFF, countryCode: "ua", countryName: "Ukraine" },
  { startHex: 0x510000, endHex: 0x5107FF, countryCode: "by", countryName: "Belarus" },
  { startHex: 0x511000, endHex: 0x5117FF, countryCode: "ee", countryName: "Estonia" },
  { startHex: 0x512000, endHex: 0x5127FF, countryCode: "mk", countryName: "North Macedonia" },
  { startHex: 0x513000, endHex: 0x5137FF, countryCode: "ba", countryName: "Bosnia and Herzegovina" },
  { startHex: 0x514000, endHex: 0x5147FF, countryCode: "ge", countryName: "Georgia" },
  { startHex: 0x515000, endHex: 0x5157FF, countryCode: "tj", countryName: "Tajikistan" },
  { startHex: 0x516000, endHex: 0x5167FF, countryCode: "me", countryName: "Montenegro" },
  { startHex: 0x600000, endHex: 0x6007FF, countryCode: "am", countryName: "Armenia" },
  { startHex: 0x600800, endHex: 0x600FFF, countryCode: "az", countryName: "Azerbaijan" },
  { startHex: 0x601000, endHex: 0x6017FF, countryCode: "kg", countryName: "Kyrgyzstan" },
  { startHex: 0x601800, endHex: 0x601FFF, countryCode: "tm", countryName: "Turkmenistan" },
  { startHex: 0x680000, endHex: 0x6807FF, countryCode: "bt", countryName: "Bhutan" },
  { startHex: 0x681000, endHex: 0x6817FF, countryCode: "fm", countryName: "Micronesia, Federated States of" },
  { startHex: 0x682000, endHex: 0x6827FF, countryCode: "mn", countryName: "Mongolia" },
  { startHex: 0x683000, endHex: 0x6837FF, countryCode: "kz", countryName: "Kazakhstan" },
  { startHex: 0x684000, endHex: 0x6847FF, countryCode: "pw", countryName: "Palau" },
  { startHex: 0x700000, endHex: 0x700FFF, countryCode: "af", countryName: "Afghanistan" },
  { startHex: 0x702000, endHex: 0x702FFF, countryCode: "bd", countryName: "Bangladesh" },
  { startHex: 0x704000, endHex: 0x704FFF, countryCode: "mm", countryName: "Myanmar" },
  { startHex: 0x706000, endHex: 0x706FFF, countryCode: "kw", countryName: "Kuwait" },
  { startHex: 0x708000, endHex: 0x708FFF, countryCode: "la", countryName: "Laos" },
  { startHex: 0x70A000, endHex: 0x70AFFF, countryCode: "np", countryName: "Nepal" },
  { startHex: 0x70C000, endHex: 0x70C7FF, countryCode: "om", countryName: "Oman" },
  { startHex: 0x70E000, endHex: 0x70EFFF, countryCode: "kh", countryName: "Cambodia" },
  { startHex: 0x710000, endHex: 0x717FFF, countryCode: "sa", countryName: "Saudi Arabia" },
  { startHex: 0x718000, endHex: 0x71FFFF, countryCode: "kr", countryName: "South Korea" },
  { startHex: 0x720000, endHex: 0x727FFF, countryCode: "kp", countryName: "North Korea" },
  { startHex: 0x728000, endHex: 0x72FFFF, countryCode: "iq", countryName: "Iraq" },
  { startHex: 0x730000, endHex: 0x737FFF, countryCode: "ir", countryName: "Iran" },
  { startHex: 0x738000, endHex: 0x73FFFF, countryCode: "il", countryName: "Israel" },
  { startHex: 0x740000, endHex: 0x747FFF, countryCode: "jo", countryName: "Jordan" },
  { startHex: 0x748000, endHex: 0x74FFFF, countryCode: "lb", countryName: "Lebanon" },
  { startHex: 0x750000, endHex: 0x757FFF, countryCode: "my", countryName: "Malaysia" },
  { startHex: 0x758000, endHex: 0x75FFFF, countryCode: "ph", countryName: "Philippines" },
  { startHex: 0x760000, endHex: 0x767FFF, countryCode: "pk", countryName: "Pakistan" },
  { startHex: 0x768000, endHex: 0x76FFFF, countryCode: "sg", countryName: "Singapore" },
  { startHex: 0x770000, endHex: 0x777FFF, countryCode: "lk", countryName: "Sri Lanka" },
  { startHex: 0x778000, endHex: 0x77FFFF, countryCode: "sy", countryName: "Syria" },
  { startHex: 0x789000, endHex: 0x789FFF, countryCode: "hk", countryName: "Hong Kong" },
  { startHex: 0x780000, endHex: 0x7BFFFF, countryCode: "cn", countryName: "China" },
  { startHex: 0x7C0000, endHex: 0x7FFFFF, countryCode: "au", countryName: "Australia" },
  { startHex: 0x800000, endHex: 0x83FFFF, countryCode: "in", countryName: "India" },
  { startHex: 0x840000, endHex: 0x87FFFF, countryCode: "jp", countryName: "Japan" },
  { startHex: 0x880000, endHex: 0x887FFF, countryCode: "th", countryName: "Thailand" },
  { startHex: 0x888000, endHex: 0x88FFFF, countryCode: "vn", countryName: "Vietnam" },
  { startHex: 0x890000, endHex: 0x890FFF, countryCode: "ye", countryName: "Yemen" },
  { startHex: 0x894000, endHex: 0x894FFF, countryCode: "bh", countryName: "Bahrain" },
  { startHex: 0x895000, endHex: 0x8957FF, countryCode: "bn", countryName: "Brunei" },
  { startHex: 0x896000, endHex: 0x896FFF, countryCode: "ae", countryName: "United Arab Emirates" },
  { startHex: 0x897000, endHex: 0x8977FF, countryCode: "sb", countryName: "Solomon Islands" },
  { startHex: 0x898000, endHex: 0x898FFF, countryCode: "pg", countryName: "Papua New Guinea" },
  { startHex: 0x899000, endHex: 0x8997FF, countryCode: "tw", countryName: "Taiwan" },
  { startHex: 0x8A0000, endHex: 0x8A7FFF, countryCode: "id", countryName: "Indonesia" },
  { startHex: 0x900000, endHex: 0x9007FF, countryCode: "mh", countryName: "Marshall Islands" },
  { startHex: 0x901000, endHex: 0x9017FF, countryCode: "ck", countryName: "Cook Islands" },
  { startHex: 0x902000, endHex: 0x9027FF, countryCode: "ws", countryName: "Samoa" },
  { startHex: 0xA00000, endHex: 0xAFFFFF, countryCode: "us", countryName: "United States" },
  { startHex: 0xC00000, endHex: 0xC3FFFF, countryCode: "ca", countryName: "Canada" },
  { startHex: 0xC80000, endHex: 0xC87FFF, countryCode: "nz", countryName: "New Zealand" },
  { startHex: 0xC88000, endHex: 0xC88FFF, countryCode: "fj", countryName: "Fiji" },
  { startHex: 0xC8A000, endHex: 0xC8A7FF, countryCode: "nr", countryName: "Nauru" },
  { startHex: 0xC8C000, endHex: 0xC8C7FF, countryCode: "lc", countryName: "Saint Lucia" },
  { startHex: 0xC8D000, endHex: 0xC8D7FF, countryCode: "to", countryName: "Tonga" },
  { startHex: 0xC8E000, endHex: 0xC8E7FF, countryCode: "ki", countryName: "Kiribati" },
  { startHex: 0xC90000, endHex: 0xC907FF, countryCode: "vu", countryName: "Vanuatu" },
  { startHex: 0xC91000, endHex: 0xC917FF, countryCode: "ad", countryName: "Andorra" },
  { startHex: 0xC92000, endHex: 0xC927FF, countryCode: "dm", countryName: "Dominica" },
  { startHex: 0xC93000, endHex: 0xC937FF, countryCode: "kn", countryName: "Saint Kitts and Nevis" },
  { startHex: 0xC94000, endHex: 0xC947FF, countryCode: "ss", countryName: "South Sudan" },
  { startHex: 0xC95000, endHex: 0xC957FF, countryCode: "tl", countryName: "Timor-Leste" },
  { startHex: 0xC97000, endHex: 0xC977FF, countryCode: "tv", countryName: "Tuvalu" },
  { startHex: 0xE00000, endHex: 0xE3FFFF, countryCode: "ar", countryName: "Argentina" },
  { startHex: 0xE40000, endHex: 0xE7FFFF, countryCode: "br", countryName: "Brazil" },
  { startHex: 0xE80000, endHex: 0xE80FFF, countryCode: "cl", countryName: "Chile" },
  { startHex: 0xE84000, endHex: 0xE84FFF, countryCode: "ec", countryName: "Ecuador" },
  { startHex: 0xE88000, endHex: 0xE88FFF, countryCode: "py", countryName: "Paraguay" },
  { startHex: 0xE8C000, endHex: 0xE8CFFF, countryCode: "pe", countryName: "Peru" },
  { startHex: 0xE90000, endHex: 0xE90FFF, countryCode: "uy", countryName: "Uruguay" },
  { startHex: 0xE94000, endHex: 0xE94FFF, countryCode: "bo", countryName: "Bolivia" },
];

const INDEXED_COUNTRY_RANGES: IndexedCountryRange[] = COUNTRY_RANGES
  .map((range, priority) => ({
    ...range,
    span: range.endHex - range.startHex,
    priority,
  }))
  .sort((left, right) => {
    if (left.startHex !== right.startHex) {
      return left.startHex - right.startHex;
    }
    if (left.span !== right.span) {
      return left.span - right.span;
    }
    return left.priority - right.priority;
  });

export function normalizeIcaoHex(icao: string): string | null {
  const normalized = icao.trim().toUpperCase();
  if (normalized.length !== 6) {
    return null;
  }
  if (!/^[0-9A-F]{6}$/u.test(normalized)) {
    return null;
  }
  return normalized;
}

export function buildCountryFlagUrl(countryCode: string): string {
  return `${FLAG_CDN_BASE_URL}/${countryCode.trim().toLowerCase()}.png`;
}

export function findIcaoCountry(icao: string): IcaoCountryInfo | null {
  const normalized = normalizeIcaoHex(icao);
  if (!normalized) {
    return null;
  }

  const hex = Number.parseInt(normalized, 16);
  const country = findCountryRange(hex);
  if (!country) {
    return null;
  }

  return {
    countryCode: country.countryCode.toUpperCase(),
    countryName: country.countryName,
    countryFlagUrl: buildCountryFlagUrl(country.countryCode),
  };
}

function findCountryRange(hex: number): IndexedCountryRange | null {
  let low = 0;
  let high = INDEXED_COUNTRY_RANGES.length - 1;
  let candidateIndex = -1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const range = INDEXED_COUNTRY_RANGES[middle];
    if (range.startHex <= hex) {
      candidateIndex = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  if (candidateIndex < 0) {
    return null;
  }

  let bestMatch: IndexedCountryRange | null = null;
  for (let index = candidateIndex; index >= 0; index -= 1) {
    const range = INDEXED_COUNTRY_RANGES[index];
    if (range.startHex > hex) {
      continue;
    }
    if (range.endHex < hex) {
      continue;
    }
    if (
      bestMatch == null
      || range.span < bestMatch.span
      || (range.span === bestMatch.span && range.priority < bestMatch.priority)
    ) {
      bestMatch = range;
    }
  }

  return bestMatch;
}
