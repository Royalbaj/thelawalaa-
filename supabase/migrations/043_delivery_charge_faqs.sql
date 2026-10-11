-- 043: the FAQs say what delivery costs now (migration 042's Rs 20 under Rs 99).
-- Applied together with the code that charges it, so the site never says one thing and charges another.

UPDATE public.faqs
SET answer = 'Yes. We deliver within 5km of our Godam Chowk store — free on orders of Rs 99 or more, Rs 20 below that. Enter your address at checkout and we''ll confirm you''re inside the delivery zone.'
WHERE question = 'Do you deliver in Banepa and Godam Chowk?';
UPDATE public.faqs
SET answer = 'Free on orders of Rs 99 or more anywhere within 5km of the store, and Rs 20 below that — checkout shows it before you order. You can also choose pickup and collect it hot from our Godam Chowk counter.'
WHERE question = 'How much is delivery?';
