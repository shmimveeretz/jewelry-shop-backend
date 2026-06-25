import CategoryMongo from "../models/CategoryMongo.js";

const DEFAULT_CATEGORIES = [
  {
    slug: "אותיות עבריות",
    nameHe: "כתב עברי קדום",
    nameEn: "Ancient Hebrew Script",
    descriptionHe:
      "בכתב העברי הקדום זורם אורו של הבורא בימי ממלכת ישראל המאוחדת",
    descriptionEn:
      "In the ancient Hebrew script flows the light of the Creator in the days of the united Kingdom of Israel",
    image:
      "https://res.cloudinary.com/dhayarvh3/image/upload/v1771407399/Ancient_Hebrew.jpg",
    sortOrder: 1,
  },
  {
    slug: "כוכבים",
    nameHe: "כוכבי הלכת",
    nameEn: "Stars Pendants",
    descriptionHe:
      "וַיַּעַשׂ אֱלֹהִים אֵת שְׁנֵי הַמְּאֹרֹת הַגְּדֹלִים אֶת־הַמָּאוֹר הַגָּדֹל לְמֶמְשֶׁלֶת הַיּוֹם וְאֵת הַמָּאוֹר הַקָּטֹן לְמֶמְשֶׁלֶת הַלַּיְלָה וְאֵת הַכּוֹכָבִים",
    descriptionEn:
      "And God made the two great lights—the greater light to govern the day and the lesser light to govern the night—and the stars",
    sourceHe: "בְּרֵאשִׁית א׳:ט״ז",
    sourceEn: "Genesis 1:16",
    image:
      "https://res.cloudinary.com/dhayarvh3/image/upload/v1771410177/Planets.jpg",
    sortOrder: 2,
  },
  {
    slug: "תליוני מזלות",
    nameHe: "תליוני מזלות",
    nameEn: "Zodiac Pendants",
    descriptionHe:
      "בִּדְבַר יְהֹוָה שָׁמַיִם נֶעֱשׂוּ וּבְרוּחַ פִּיו כָּל־צְבָאָם",
    descriptionEn:
      "By the word of the LORD the heavens were made, and by the breath of His mouth all their host",
    sourceHe: "תְּהִלִּים ל״ג:ו׳",
    sourceEn: "Psalms 33:6",
    image:
      "https://res.cloudinary.com/dhayarvh3/image/upload/v1771410086/Zodiac_Pendants.jpg",
    sortOrder: 3,
  },
  {
    slug: "אבני חושן",
    nameHe: "אבני חושן",
    nameEn: "Hoshen Stones",
    descriptionHe:
      "וְהָאֲבָנִים תִּהְיֶיןָ עַל־שְׁמֹת בְּנֵי־יִשְׂרָאֵל שְׁתֵּים עֶשְׂרֵה עַל־שְׁמוֹתָם פִּתּוּחֵי חוֹתָם אִישׁ עַל־שְׁמוֹ תִּהְיֶיןָ לִשְׁנֵי עָשָׂר שָׁבֶט",
    descriptionEn:
      "And the stones shall be on the names of the sons of Israel, twelve according to their names, like the engravings of a signet, every one according to his name shall they be for the twelve tribes",
    sourceHe: "שְׁמוֹת כ״ח:כ״א",
    sourceEn: "Exodus 28:21",
    image:
      "https://res.cloudinary.com/dhayarvh3/image/upload/v1771410296/Hoshen_Stones.jpg",
    sortOrder: 4,
  },
  {
    slug: "שלישיות מיוחדות",
    nameHe: "מזל, אבן חושן וכוכב",
    nameEn: "Trinity Pendants",
    descriptionHe:
      "שֶׁמַּזָּל, כּוֹכָב וְאֶבֶן חוֹשֶׁן נִפְגָּשִׁים = הַנְּשָׁמָה נִזְכֶּרֶת",
    descriptionEn:
      "When zodiac, star and hoshen stone meet — the soul is remembered",
    image:
      "https://res.cloudinary.com/dhayarvh3/image/upload/v1771406947/Trinity.jpg",
    sortOrder: 5,
  },
  {
    slug: "שילת",
    nameHe: "שילת",
    nameEn: "Shilat",
    descriptionHe: "שְׂאוּ מָרוֹם עֵינֵיכֶם וּרְאוּ מִי־בָרָא אֵלֶּה",
    descriptionEn: "Lift up your eyes on high and see: who created these?",
    sourceHe: "יְשַׁעְיָהוּ מ׳:כ״ו",
    sourceEn: "Isaiah 40:26",
    image:
      "https://res.cloudinary.com/dhayarvh3/image/upload/v1771152721/AboutBG.jpg",
    sortOrder: 6,
  },
];

async function ensureDefaultCategories() {
  const count = await CategoryMongo.countDocuments();
  if (count === 0) {
    await CategoryMongo.insertMany(DEFAULT_CATEGORIES);
  }
}

export const getCategories = async (req, res) => {
  try {
    await ensureDefaultCategories();
    const includeInactive = req.query.all === "true" && req.user?.role;
    const filter = includeInactive &&
      (req.user.role === "admin" || req.user.role === "roi")
      ? {}
      : { active: true };

    const categories = await CategoryMongo.find(filter).sort({
      sortOrder: 1,
      nameHe: 1,
    });

    res.json({ success: true, data: categories, total: categories.length });
  } catch (error) {
    console.error("❌ getCategories:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createCategory = async (req, res) => {
  try {
    const { slug, nameHe, nameEn, descriptionHe, descriptionEn, image, sortOrder } =
      req.body;

    if (!slug?.trim() || !nameHe?.trim()) {
      return res.status(400).json({
        success: false,
        message: "שם קטגוריה (עברית) ומזהה נדרשים",
      });
    }

    const existing = await CategoryMongo.findOne({ slug: slug.trim() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "קטגוריה עם מזהה זה כבר קיימת",
      });
    }

    const category = await CategoryMongo.create({
      slug: slug.trim(),
      nameHe: nameHe.trim(),
      nameEn: nameEn?.trim() || "",
      descriptionHe: descriptionHe?.trim() || "",
      descriptionEn: descriptionEn?.trim() || "",
      image: image?.trim() || "",
      sortOrder: sortOrder ?? (await CategoryMongo.countDocuments()) + 1,
      active: true,
    });

    res.status(201).json({
      success: true,
      message: "קטגוריה נוצרה בהצלחה",
      data: category,
    });
  } catch (error) {
    console.error("❌ createCategory:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };
    delete updates._id;

    const category = await CategoryMongo.findByIdAndUpdate(id, updates, {
      new: true,
    });

    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "קטגוריה לא נמצאה" });
    }

    res.json({
      success: true,
      message: "קטגוריה עודכנה בהצלחה",
      data: category,
    });
  } catch (error) {
    console.error("❌ updateCategory:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await CategoryMongo.findByIdAndDelete(id);

    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "קטגוריה לא נמצאה" });
    }

    res.json({ success: true, message: "קטגוריה נמחקה בהצלחה" });
  } catch (error) {
    console.error("❌ deleteCategory:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
