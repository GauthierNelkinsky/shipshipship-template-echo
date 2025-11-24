# ShipShipShip Echo Template

A clean and modern event/idea display template for ShipShipShip, built with **Svelte 5**.

## Features

- **List Layout** - Events are displayed in a clean vertical list
- **Voting System** - Users can vote for events they like
- **Advanced Filtering** - Filter events by search query, tags, and sort order
- **Responsive Design** - Works perfectly on mobile, tablet, and desktop
- **Dark Mode Support** - Automatic dark mode based on system preferences
- **Real-time Updates** - Vote counts update instantly

## Installation

1. Clone this template or install via ShipShipShip
2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure your API endpoint in `.env.local`:
   ```
   VITE_ADMIN_API_URL=http://localhost:3000
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## Usage

### Viewing Events

Events are displayed in a clean vertical list layout. Each item shows:
- Title and description
- Tags/categories
- Vote count
- Creation date
- Status

### Voting

Users can vote for events they like by clicking the thumbs-up button on any card. Votes are tracked locally and synced with the backend.

### Filtering

Events can be filtered in multiple ways:
- **Search** - Type keywords to find specific events
- **Tags** - Click on tags to filter by category
- **Sort** - Sort by newest, oldest, or most popular

## Customization

### Colors

Modify the color scheme in `src/app.css` by changing the CSS custom properties:

```css
:root {
    --primary: 221.2 83.2% 53.3%;
    --background: 0 0% 100%;
    /* ... other colors */
}
```

### Branding

Update your logo and site settings through the ShipShipShip admin panel:
- Logo URL
- Dark mode logo
- Favicon
- Site title

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run check` - Type check the project
- `npm run format` - Format code with Prettier
- `npm run lint` - Lint code

## Tech Stack

- **Svelte 5** - Latest version with runes syntax for better performance
- **SvelteKit 2** - Modern web framework
- **TypeScript 5.7** - Type-safe JavaScript
- **Tailwind CSS 3** - Utility-first CSS
- **Vite 6** - Lightning-fast build tool
- **Lucide Icons** - Beautiful icon set
- **Svelte Sonner** - Toast notifications

## Svelte 5

This template uses the latest Svelte 5 with runes syntax (`$state`, `$derived`, `$effect`). See [SVELTE5.md](SVELTE5.md) for migration notes and best practices.

## License

MIT

## Support

For issues and questions, visit the [ShipShipShip GitHub repository](https://github.com/GauthierNelkinsky/ShipShipShip).

---

Built with ❤️ by the ShipShipShip team