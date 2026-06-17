"""
Bulk seed police stations into the FIR Sahayak database.
Run once from the backend/ directory:
    python seed_stations.py
Skips stations that already exist (safe to re-run).
"""

import asyncio
import uuid
import os
import sys

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

load_dotenv()

sys.path.insert(0, os.path.dirname(__file__))
from app.models.fir import PoliceStation

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not found in .env")
    sys.exit(1)

# ── Station data: (name, district, state, address, phone) ─────────────────────
STATIONS = [
    # ── DELHI ─────────────────────────────────────────────────────────────────
    ("Connaught Place Police Station",     "New Delhi",          "Delhi",          "Connaught Place, New Delhi - 110001",                  "011-23415289"),
    ("Parliament Street Police Station",   "New Delhi",          "Delhi",          "Parliament Street, New Delhi - 110001",                "011-23748750"),
    ("Karol Bagh Police Station",          "Central Delhi",      "Delhi",          "Karol Bagh, New Delhi - 110005",                       "011-25722610"),
    ("Paharganj Police Station",           "Central Delhi",      "Delhi",          "Paharganj, New Delhi - 110055",                        "011-23523213"),
    ("Lajpat Nagar Police Station",        "South Delhi",        "Delhi",          "Lajpat Nagar, New Delhi - 110024",                     "011-29814009"),
    ("Hauz Khas Police Station",           "South Delhi",        "Delhi",          "Hauz Khas, New Delhi - 110016",                        "011-26518844"),
    ("Rohini Police Station",              "North West Delhi",   "Delhi",          "Rohini Sector 7, Delhi - 110085",                      "011-27571920"),
    ("Dwarka Sector 10 Police Station",    "South West Delhi",   "Delhi",          "Sector 10, Dwarka, Delhi - 110075",                    "011-25092533"),
    ("Saket Police Station",               "South Delhi",        "Delhi",          "Saket, New Delhi - 110017",                            "011-29561007"),
    ("Mayur Vihar Police Station",         "East Delhi",         "Delhi",          "Mayur Vihar Phase 1, Delhi - 110091",                  "011-22754611"),

    # ── MAHARASHTRA — Mumbai ───────────────────────────────────────────────────
    ("Colaba Police Station",              "Mumbai City",        "Maharashtra",    "Colaba Causeway, Mumbai - 400005",                     "022-22161855"),
    ("Bandra Police Station",              "Mumbai Suburban",    "Maharashtra",    "SV Road, Bandra West, Mumbai - 400050",                "022-26551284"),
    ("Andheri Police Station",             "Mumbai Suburban",    "Maharashtra",    "Andheri East, Mumbai - 400069",                        "022-26833333"),
    ("Dharavi Police Station",             "Mumbai City",        "Maharashtra",    "Dharavi Cross Road, Mumbai - 400017",                  "022-24014050"),
    ("Juhu Police Station",                "Mumbai Suburban",    "Maharashtra",    "Juhu Tara Road, Mumbai - 400049",                      "022-26208081"),
    ("Borivali Police Station",            "Mumbai Suburban",    "Maharashtra",    "Borivali West, Mumbai - 400092",                       "022-28920606"),
    ("Kurla Police Station",               "Mumbai Suburban",    "Maharashtra",    "Nehru Nagar, Kurla East, Mumbai - 400024",             "022-25040020"),
    # Maharashtra — Pune
    ("Shivajinagar Police Station",        "Pune",               "Maharashtra",    "FC Road, Shivajinagar, Pune - 411005",                 "020-25536226"),
    ("Hadapsar Police Station",            "Pune",               "Maharashtra",    "Hadapsar, Pune - 411028",                              "020-26990200"),
    ("Wakad Police Station",               "Pune",               "Maharashtra",    "Wakad Phata, Pimpri-Chinchwad - 411057",               "020-27652800"),
    ("Koregaon Park Police Station",       "Pune",               "Maharashtra",    "North Main Road, Koregaon Park, Pune - 411001",        "020-26153060"),
    # Maharashtra — Nagpur, Nashik, etc.
    ("Sitabuldi Police Station",           "Nagpur",             "Maharashtra",    "Sitabuldi, Nagpur - 440012",                           "0712-2525755"),
    ("Sadar Police Station Nagpur",        "Nagpur",             "Maharashtra",    "Sadar, Nagpur - 440001",                               "0712-2524444"),
    ("Nashik Road Police Station",         "Nashik",             "Maharashtra",    "Nashik Road, Nashik - 422101",                         "0253-2465300"),
    ("Chhatrapati Sambhajinagar Kotwali",  "Chhatrapati Sambhajinagar", "Maharashtra", "City Chowk, Chhatrapati Sambhajinagar - 431001",  "0240-2331900"),
    ("Thane City Police Station",          "Thane",              "Maharashtra",    "Near Railway Station, Thane West - 400601",            "022-25344141"),

    # ── KARNATAKA ─────────────────────────────────────────────────────────────
    ("Cubbon Park Police Station",         "Bangalore Urban",    "Karnataka",      "Cubbon Park, Bangalore - 560001",                      "080-22942222"),
    ("Whitefield Police Station",          "Bangalore Urban",    "Karnataka",      "Whitefield Main Road, Bangalore - 560066",             "080-28453328"),
    ("Koramangala Police Station",         "Bangalore Urban",    "Karnataka",      "80 Feet Road, Koramangala, Bangalore - 560034",        "080-25525151"),
    ("Indiranagar Police Station",         "Bangalore Urban",    "Karnataka",      "100 Feet Road, Indiranagar, Bangalore - 560038",       "080-25202020"),
    ("Yelahanka Police Station",           "Bangalore Urban",    "Karnataka",      "Yelahanka New Town, Bangalore - 560064",               "080-28569700"),
    ("Vijayanagar Police Station",         "Bangalore Urban",    "Karnataka",      "Vijayanagar, Bangalore - 560040",                      "080-23302020"),
    ("Mysuru North Police Station",        "Mysuru",             "Karnataka",      "JLB Road, Mysuru - 570001",                            "0821-2443877"),
    ("Mangaluru East Police Station",      "Dakshina Kannada",   "Karnataka",      "Balmatta Road, Mangaluru - 575001",                    "0824-2440833"),

    # ── TAMIL NADU ────────────────────────────────────────────────────────────
    ("T Nagar Police Station",             "Chennai",            "Tamil Nadu",     "Usman Road, T Nagar, Chennai - 600017",                "044-24344800"),
    ("Mylapore Police Station",            "Chennai",            "Tamil Nadu",     "Mylapore, Chennai - 600004",                           "044-24981020"),
    ("Anna Nagar Police Station",          "Chennai",            "Tamil Nadu",     "Anna Nagar West, Chennai - 600040",                    "044-26281080"),
    ("Adyar Police Station",               "Chennai",            "Tamil Nadu",     "LB Road, Adyar, Chennai - 600020",                     "044-24424747"),
    ("Egmore Police Station",              "Chennai",            "Tamil Nadu",     "Egmore, Chennai - 600008",                             "044-28193030"),
    ("Tambaram Police Station",            "Chengalpattu",       "Tamil Nadu",     "Tambaram, Chennai - 600045",                           "044-22262222"),
    ("Coimbatore South Police Station",    "Coimbatore",         "Tamil Nadu",     "DB Road, Coimbatore - 641001",                         "0422-2302222"),
    ("Madurai East Police Station",        "Madurai",            "Tamil Nadu",     "Mattuthavani, Madurai - 625007",                       "0452-2345678"),

    # ── TELANGANA ─────────────────────────────────────────────────────────────
    ("Banjara Hills Police Station",       "Hyderabad",          "Telangana",      "Road No. 12, Banjara Hills, Hyderabad - 500034",       "040-23563601"),
    ("Jubilee Hills Police Station",       "Hyderabad",          "Telangana",      "Road No. 36, Jubilee Hills, Hyderabad - 500033",       "040-23559833"),
    ("Cyberabad Police Station",           "Ranga Reddy",        "Telangana",      "Madhapur, Hyderabad - 500081",                         "040-29705555"),
    ("Secunderabad Police Station",        "Hyderabad",          "Telangana",      "MG Road, Secunderabad - 500003",                       "040-27805555"),
    ("Charminar Police Station",           "Hyderabad",          "Telangana",      "Charminar, Hyderabad - 500002",                        "040-24521600"),
    ("Kukatpally Police Station",          "Medchal-Malkajgiri", "Telangana",      "KPHB Colony, Kukatpally, Hyderabad - 500072",          "040-23020202"),

    # ── UTTAR PRADESH ─────────────────────────────────────────────────────────
    ("Hazratganj Police Station",          "Lucknow",            "Uttar Pradesh",  "Hazratganj, Lucknow - 226001",                         "0522-2200200"),
    ("Chowk Police Station Lucknow",       "Lucknow",            "Uttar Pradesh",  "Chowk, Lucknow - 226003",                              "0522-2631066"),
    ("Gomti Nagar Police Station",         "Lucknow",            "Uttar Pradesh",  "Gomti Nagar, Lucknow - 226010",                        "0522-2307766"),
    ("Sector 20 Police Station Noida",     "Gautam Buddha Nagar","Uttar Pradesh",  "Sector 20, Noida - 201301",                            "0120-2427288"),
    ("Sector 58 Police Station Noida",     "Gautam Buddha Nagar","Uttar Pradesh",  "Sector 58, Noida - 201309",                            "0120-2580100"),
    ("Agra Cantonment Police Station",     "Agra",               "Uttar Pradesh",  "Cantonment, Agra - 282001",                            "0562-2421180"),
    ("Lanka Police Station Varanasi",      "Varanasi",           "Uttar Pradesh",  "Lanka, Varanasi - 221005",                             "0542-2368059"),
    ("Kanpur City Kotwali",                "Kanpur",             "Uttar Pradesh",  "Kotwali, Mall Road, Kanpur - 208001",                  "0512-2540101"),

    # ── GUJARAT ───────────────────────────────────────────────────────────────
    ("Ellisbridge Police Station",         "Ahmedabad",          "Gujarat",        "Ellisbridge, Ahmedabad - 380006",                      "079-26578400"),
    ("Vastrapur Police Station",           "Ahmedabad",          "Gujarat",        "Vastrapur, Ahmedabad - 380015",                        "079-26302501"),
    ("Surat Central Police Station",       "Surat",              "Gujarat",        "Ring Road, Surat - 395002",                            "0261-2464200"),
    ("Adajan Police Station",              "Surat",              "Gujarat",        "Adajan Patia, Surat - 395009",                         "0261-2785200"),
    ("Vadodara City Police Station",       "Vadodara",           "Gujarat",        "Khanderao Market, Vadodara - 390001",                  "0265-2416700"),
    ("Rajkot Central Police Station",      "Rajkot",             "Gujarat",        "Dhebarbhai Road, Rajkot - 360001",                     "0281-2480777"),

    # ── WEST BENGAL ───────────────────────────────────────────────────────────
    ("Lalbazar Police Station",            "Kolkata",            "West Bengal",    "Lalbazar Street, Kolkata - 700001",                    "033-22501040"),
    ("Park Street Police Station",         "Kolkata",            "West Bengal",    "Park Street, Kolkata - 700016",                        "033-22298531"),
    ("Jadavpur Police Station",            "Kolkata",            "West Bengal",    "Jadavpur, Kolkata - 700032",                           "033-24143737"),
    ("Salt Lake Police Station",           "North 24 Parganas",  "West Bengal",    "Sector V, Salt Lake City, Kolkata - 700091",           "033-23590410"),
    ("Howrah Sadar Police Station",        "Howrah",             "West Bengal",    "Howrah, West Bengal - 711101",                         "033-26385011"),
    ("Asansol Police Station",             "Paschim Bardhaman",  "West Bengal",    "GT Road, Asansol - 713301",                            "0341-2203030"),

    # ── RAJASTHAN ─────────────────────────────────────────────────────────────
    ("Ashok Nagar Police Station",         "Jaipur",             "Rajasthan",      "Ashok Nagar, Jaipur - 302001",                         "0141-2741444"),
    ("Malviya Nagar Police Station",       "Jaipur",             "Rajasthan",      "Malviya Nagar, Jaipur - 302017",                       "0141-2524444"),
    ("Jodhpur Sadar Police Station",       "Jodhpur",            "Rajasthan",      "Sadar Bazaar, Jodhpur - 342001",                       "0291-2622777"),
    ("Udaipur Sadar Police Station",       "Udaipur",            "Rajasthan",      "Sadar Bazaar, Udaipur - 313001",                       "0294-2525888"),
    ("Ajmer Kotwali",                      "Ajmer",              "Rajasthan",      "Kotwali, Ajmer - 305001",                              "0145-2624488"),

    # ── PUNJAB ────────────────────────────────────────────────────────────────
    ("Hall Bazaar Police Station",         "Amritsar",           "Punjab",         "Hall Bazaar, Amritsar - 143001",                       "0183-2552222"),
    ("Sector 17 Police Station",           "Chandigarh",         "Punjab",         "Sector 17, Chandigarh - 160017",                       "0172-2740155"),
    ("Ludhiana City Police Station",       "Ludhiana",           "Punjab",         "Ferozepur Road, Ludhiana - 141001",                    "0161-2408000"),
    ("Jalandhar Sadar Police Station",     "Jalandhar",          "Punjab",         "Sadar Bazaar, Jalandhar - 144001",                     "0181-2222555"),

    # ── HARYANA ───────────────────────────────────────────────────────────────
    ("Gurugram City Police Station",       "Gurugram",           "Haryana",        "Civil Lines, Gurugram - 122001",                       "0124-2322211"),
    ("Faridabad Sadar Police Station",     "Faridabad",          "Haryana",        "Sector 29, NIT Faridabad - 121001",                    "0129-2414000"),
    ("Panchkula Police Station",           "Panchkula",          "Haryana",        "Sector 5, Panchkula - 134109",                         "0172-2561044"),
    ("Ambala Cantonment Police Station",   "Ambala",             "Haryana",        "Ambala Cantonment - 133001",                           "0171-2600200"),

    # ── MADHYA PRADESH ────────────────────────────────────────────────────────
    ("Kotwali Police Station Bhopal",      "Bhopal",             "Madhya Pradesh", "Kotwali, Bhopal - 462001",                             "0755-2741444"),
    ("Shyamla Hills Police Station",       "Bhopal",             "Madhya Pradesh", "Shyamla Hills, Bhopal - 462002",                       "0755-2661007"),
    ("Indore Sadar Police Station",        "Indore",             "Madhya Pradesh", "MG Road, Indore - 452001",                             "0731-2542500"),
    ("Vijay Nagar Police Station",         "Indore",             "Madhya Pradesh", "Vijay Nagar, Indore - 452010",                         "0731-4080100"),

    # ── KERALA ────────────────────────────────────────────────────────────────
    ("Thiruvananthapuram Central",         "Thiruvananthapuram", "Kerala",         "Museum Road, Thiruvananthapuram - 695001",              "0471-2320800"),
    ("Ernakulam South Police Station",     "Ernakulam",          "Kerala",         "South, Ernakulam, Kochi - 682016",                     "0484-2382600"),
    ("Kozhikode City Police Station",      "Kozhikode",          "Kerala",         "SM Street, Kozhikode - 673001",                        "0495-2721500"),
    ("Thrissur Town Police Station",       "Thrissur",           "Kerala",         "MO Road, Thrissur - 680001",                           "0487-2360900"),

    # ── BIHAR ─────────────────────────────────────────────────────────────────
    ("Kotwali Police Station Patna",       "Patna",              "Bihar",          "Kotwali, Patna - 800001",                              "0612-2205050"),
    ("Gandhi Maidan Police Station",       "Patna",              "Bihar",          "Gandhi Maidan, Patna - 800001",                        "0612-2200810"),
    ("Gaya Town Police Station",           "Gaya",               "Bihar",          "Gaya Town, Bihar - 823001",                            "0631-2220100"),

    # ── ODISHA ────────────────────────────────────────────────────────────────
    ("Saheed Nagar Police Station",        "Bhubaneswar",        "Odisha",         "Saheed Nagar, Bhubaneswar - 751007",                   "0674-2547444"),
    ("Cuttack Sadar Police Station",       "Cuttack",            "Odisha",         "College Square, Cuttack - 753003",                     "0671-2614242"),

    # ── ASSAM ─────────────────────────────────────────────────────────────────
    ("Dispur Police Station",              "Kamrup Metro",       "Assam",          "Dispur, Guwahati - 781005",                            "0361-2237777"),
    ("Paltan Bazaar Police Station",       "Kamrup Metro",       "Assam",          "Paltan Bazaar, Guwahati - 781008",                     "0361-2630334"),

    # ── HIMACHAL PRADESH ──────────────────────────────────────────────────────
    ("Shimla Sadar Police Station",        "Shimla",             "Himachal Pradesh","Cart Road, Shimla - 171001",                          "0177-2652520"),
    ("Dharamshala Police Station",         "Kangra",             "Himachal Pradesh","Dharamshala, Kangra - 176215",                        "01892-222500"),

    # ── UTTARAKHAND ───────────────────────────────────────────────────────────
    ("Dehradun Sadar Police Station",      "Dehradun",           "Uttarakhand",    "Sadar Bazaar, Dehradun - 248001",                      "0135-2714000"),
    ("Haridwar Police Station",            "Haridwar",           "Uttarakhand",    "Upper Road, Haridwar - 249401",                        "01334-227400"),

    # ── JHARKHAND ─────────────────────────────────────────────────────────────
    ("Ranchi Sadar Police Station",        "Ranchi",             "Jharkhand",      "Main Road, Ranchi - 834001",                           "0651-2208800"),
    ("Dhanbad Sadar Police Station",       "Dhanbad",            "Jharkhand",      "Bank More, Dhanbad - 826001",                          "0326-2310100"),

    # ── CHHATTISGARH ──────────────────────────────────────────────────────────
    ("Raipur Kotwali",                     "Raipur",             "Chhattisgarh",   "Kotwali, Raipur - 492001",                             "0771-4080200"),
    ("Bilaspur Sadar Police Station",      "Bilaspur",           "Chhattisgarh",   "Civil Lines, Bilaspur - 495001",                       "07752-240100"),

    # ── GOA ───────────────────────────────────────────────────────────────────
    ("Panaji Police Station",              "North Goa",          "Goa",            "Panaji, Goa - 403001",                                 "0832-2224488"),
    ("Margao Police Station",              "South Goa",          "Goa",            "Margao, South Goa - 403601",                           "0832-2705144"),

    # ── CHANDIGARH (UT) ───────────────────────────────────────────────────────
    ("Chandigarh Sector 3 Police Station", "Chandigarh",         "Chandigarh",     "Sector 3, Chandigarh - 160003",                        "0172-2740100"),
    ("Chandigarh Sector 36 Police Station","Chandigarh",         "Chandigarh",     "Sector 36, Chandigarh - 160036",                       "0172-2665100"),
]


async def seed():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        existing = (await session.exec(select(PoliceStation))).all()
        existing_names = {s.name for s in existing}
        print(f"Existing stations in DB : {len(existing_names)}")

        to_add = [(n, d, s, a, p) for n, d, s, a, p in STATIONS if n not in existing_names]
        print(f"New stations to insert  : {len(to_add)}")

        if not to_add:
            print("Nothing to add — all stations already present.")
            return

        for name, district, state, address, phone in to_add:
            session.add(PoliceStation(
                id=str(uuid.uuid4()),
                name=name,
                district=district,
                state=state,
                address=address,
                phone=phone,
            ))

        await session.commit()
        print(f"Done. Total stations now: {len(existing_names) + len(to_add)}")


if __name__ == "__main__":
    asyncio.run(seed())
