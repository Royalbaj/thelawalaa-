export default function Footer() {
  return (
    <footer className="bg-brand-brown px-4 py-12 text-white">
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-3">
        <div>
          <p className="font-display text-2xl font-bold brand-gradient-text">Thelawalaa</p>
          <p className="mt-2 text-sm text-orange-100/80">
            Crispy, spicy, straight from the thela — now at your door.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-bold text-orange-100/90">
          <a href="#home" className="hover:text-white">Home</a>
          <a href="#menu" className="hover:text-white">Menu</a>
          <a href="#order" className="hover:text-white">Order</a>
          <a href="#faq" className="hover:text-white">FAQ</a>
          <a href="#contact" className="hover:text-white">Contact</a>
        </nav>
        <div className="text-sm text-orange-100/70">
          <p>Privacy Policy · Terms of Service</p>
          <p className="mt-2">© {new Date().getFullYear()} Thelawalaa.com — All rights reserved</p>
        </div>
      </div>
    </footer>
  );
}
